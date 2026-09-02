-- Memorizer — карточка может лежать в нескольких категориях.
--
-- До сих пор `cards.topic_id` — одиночная ссылка, то есть у карточки ровно
-- одно место. «Hindsight Bias одновременно в Cognitive Biases и в Decision
-- Making» без копии карточки был невозможен. А копия — это две разные истории
-- повторений одного знания, то есть прямое враньё алгоритму.
--
-- Главное место остаётся в cards.topic_id, здесь лежат только дополнительные.
-- Асимметрия намеренная: у карточки должен быть один адрес по умолчанию —
-- куда она возвращается при удалении категории, что показывает шапка сессии,
-- куда её кладёт импорт. Полностью симметричная модель заставила бы придумывать
-- «главную из равных» на каждом таком вопросе.

create table if not exists card_topics (
  card_id    uuid not null references cards(id)  on delete cascade,
  topic_id   uuid not null references topics(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, topic_id)
);

-- Индексы в обе стороны: «что лежит в этой категории» и «где ещё эта карточка»
create index if not exists card_topics_topic_idx on card_topics (topic_id, card_id);
create index if not exists card_topics_user_idx  on card_topics (user_id);

alter table card_topics enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'card_topics_owner') then
    create policy card_topics_owner on card_topics for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

grant select, insert, update, delete on card_topics to authenticated;
revoke all on card_topics from anon;

comment on table card_topics is
  'Дополнительные размещения карточки. Главное — cards.topic_id.';

-- Сколько карточек «прикреплено» к узлу помимо тех, что лежат в нём главным
-- местом. Отдельной вьюхой, потому что счётчик нужен и карте, и списку, а
-- считать его в приложении значило бы тянуть все связи ради числа под нодой.
create or replace view topic_attached with (security_invoker = on) as
  select topic_id, user_id, count(*)::int as attached
  from card_topics
  group by topic_id, user_id;

grant select on topic_attached to authenticated;
revoke all on topic_attached from anon;
