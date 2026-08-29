-- Картотека — этап 1 (ядро).
-- Выполнить в Supabase → SQL Editor. Идемпотентно при повторном запуске не является:
-- предполагается однократный прогон на чистом проекте.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────── справочники

create table topics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references topics(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  -- имя уникально только среди братьев: одинаковые подтемы в разных ветках — норма
  constraint topics_sibling_name_key unique nulls not distinct (user_id, parent_id, name)
);
create index topics_user_parent_idx on topics (user_id, parent_id, position);

create table tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (name = lower(name) and name !~ '\s'),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ─────────────────────────────────────────────── карточки

create type card_kind  as enum ('basic', 'reversed_of');
create type card_state as enum ('new', 'learning', 'review', 'relearning');

create table cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  topic_id        uuid references topics(id) on delete set null,
  front_md        text not null check (length(btrim(front_md)) > 0),
  back_md         text not null check (length(btrim(back_md)) > 0),
  note_md         text,
  kind            card_kind not null default 'basic',
  source_card_id  uuid references cards(id) on delete cascade,
  suspended       boolean not null default false,
  deleted_at      timestamptz,
  import_batch_id uuid,
  -- нормализованная лицевая сторона для поиска дублей при импорте (§7.3)
  front_norm      text generated always as
                    (lower(regexp_replace(front_md, '[^[:alnum:]]+', '', 'g'))) stored,
  search          tsvector generated always as
                    (to_tsvector('russian',
                       coalesce(front_md, '') || ' ' ||
                       coalesce(back_md, '')  || ' ' ||
                       coalesce(note_md, ''))) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index cards_user_created_idx on cards (user_id, created_at desc);
create index cards_topic_idx        on cards (topic_id);
create index cards_front_norm_idx   on cards (user_id, front_norm);
create index cards_search_idx       on cards using gin (search);

-- user_id продублирован из cards: позволяет держать простую RLS-политику
-- и индекс по тегам без подзапроса на каждую строку
create table card_tags (
  card_id  uuid not null references cards(id) on delete cascade,
  tag_id   uuid not null references tags(id)  on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  primary key (card_id, tag_id)
);
create index card_tags_tag_idx on card_tags (tag_id, card_id);

-- ─────────────────────────────────────────────── расписание и история

create table scheduling (
  card_id         uuid primary key references cards(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  state           card_state  not null default 'new',
  due             timestamptz not null default now(),
  stability       real not null default 0,
  difficulty      real not null default 0,
  elapsed_days    int  not null default 0,
  scheduled_days  int  not null default 0,
  learning_steps  int  not null default 0,
  reps            int  not null default 0,
  lapses          int  not null default 0,
  last_review     timestamptz
);
-- самый горячий запрос приложения: очередь на сегодня
create index scheduling_due_idx on scheduling (user_id, due);
create index scheduling_state_idx on scheduling (user_id, state, due);

-- append-only журнал: единственный источник для будущего переобучения весов FSRS
create table reviews (
  id           bigserial primary key,
  card_id      uuid not null references cards(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  rating       smallint not null check (rating between 1 and 4),
  reviewed_at  timestamptz not null default now(),
  duration_ms  int,
  state_before jsonb not null,
  state_after  jsonb not null
);
create index reviews_user_time_idx on reviews (user_id, reviewed_at desc);
create index reviews_card_idx      on reviews (card_id, reviewed_at desc);

create table settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  daily_new_limit    int  not null default 20,
  daily_review_limit int  not null default 150,
  request_retention  real not null default 0.90 check (request_retention between 0.7 and 0.98),
  timezone           text not null default 'UTC',
  updated_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────── триггеры

-- дерево тем не глубже трёх уровней (§6.1)
create or replace function topics_depth_guard() returns trigger
language plpgsql as $$
declare
  depth int := 1;
  p uuid := new.parent_id;
begin
  while p is not null loop
    depth := depth + 1;
    if depth > 3 then
      raise exception 'Дерево тем ограничено тремя уровнями';
    end if;
    select parent_id into p from topics where id = p;
  end loop;
  return new;
end $$;

create trigger topics_depth
  before insert or update of parent_id on topics
  for each row execute function topics_depth_guard();

-- каждая новая карточка сразу получает строку расписания:
-- так батч-импорт (этап 3) не должен помнить об этом сам
create or replace function cards_init_scheduling() returns trigger
language plpgsql as $$
begin
  insert into scheduling (card_id, user_id) values (new.id, new.user_id)
  on conflict (card_id) do nothing;
  return new;
end $$;

create trigger cards_scheduling
  after insert on cards
  for each row execute function cards_init_scheduling();

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger cards_touch
  before update on cards
  for each row execute function touch_updated_at();

-- ─────────────────────────────────────────────── RLS

alter table topics     enable row level security;
alter table tags       enable row level security;
alter table cards      enable row level security;
alter table card_tags  enable row level security;
alter table scheduling enable row level security;
alter table reviews    enable row level security;
alter table settings   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['topics','tags','cards','card_tags','scheduling','reviews','settings']
  loop
    execute format(
      'create policy %1$s_owner on %1$s for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on %1$s to authenticated', t);
  end loop;
end $$;

grant usage, select on sequence reviews_id_seq to authenticated;

-- Счётчик карточек по темам. security_invoker=on — представление наследует RLS
-- вызывающего, поэтому чужие строки в подсчёт не попадают.
create view topic_card_counts with (security_invoker = on) as
  select topic_id, count(*)::int as card_count
  from cards
  where deleted_at is null
  group by topic_id;

grant select on topic_card_counts to authenticated;
