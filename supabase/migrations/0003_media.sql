-- Картотека — этап 2: изображения на карточках.

-- ─────────────────────────────────────────────── таблицы

create type card_side as enum ('front', 'back');

create table media (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  card_id      uuid not null references cards(id) on delete cascade,
  side         card_side not null,
  storage_path text not null,
  thumb_path   text not null,
  width        int not null,
  height       int not null,
  bytes        int not null,
  caption      text,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);
create index media_card_idx on media (card_id, side, position);

-- Файлы не удаляются синхронно: путь попадает сюда, а вычищает его
-- ежедневный cron. Сюда же клиент пишет каждый только что загруженный файл —
-- если карточку так и не сохранят, мусор всё равно найдётся и удалится.
create table media_orphans (
  storage_path text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  marked_at    timestamptz not null default now()
);

-- удалили строку media — оба файла отправляются в очередь на уборку
create or replace function media_mark_orphans() returns trigger
language plpgsql as $$
begin
  insert into media_orphans (storage_path, user_id)
  values (old.storage_path, old.user_id), (old.thumb_path, old.user_id)
  on conflict (storage_path) do update set marked_at = now();
  return old;
end $$;

create trigger media_orphan_sweep
  after delete on media
  for each row execute function media_mark_orphans();

alter table media         enable row level security;
alter table media_orphans enable row level security;

do $$
declare t text;
begin
  foreach t in array array['media', 'media_orphans']
  loop
    execute format(
      'create policy %1$s_owner on %1$s for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on %1$s to authenticated', t);
    execute format('revoke all on %1$s from anon', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────── хранилище

-- Публичный бакет: приватность держится на неугадываемом UUID в пути.
-- Ограничения — вторая линия обороны: клиент и так жмёт всё в WebP до 1600 px,
-- но лимит на размер не даст залить оригинал мимо конвейера.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 5242880, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Путь: {user_id}/{card_id}/{uuid}.webp — первым сегментом идёт владелец,
-- поэтому политика проверяет права по самому пути, без обращения к таблицам.
create policy "cards_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cards_media_update" on storage.objects for update to authenticated
  using (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "cards_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
