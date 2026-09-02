-- Memorizer — удаление ВСЕХ карточек.
--
-- ЭТО НЕ МИГРАЦИЯ. Файл лежит рядом с ними, но в нумерацию не входит и сам
-- собой не выполняется: он уничтожает данные, и запускать его можно только
-- намеренно и вручную.
--
-- Что удаляется:
--   карточки, их расписание, история повторений, связи с тегами и медиа.
-- Что остаётся:
--   категории и темы (дерево), теги, настройки, партии импорта.
--
-- Восстановить удалённое нельзя. Выгрузите данные заранее, если сомневаетесь:
--   /api/export?format=json — там карточки вместе с расписанием и историей.

begin;

-- Файлы изображений в очередь на уборку. Триггер на media делает это сам при
-- удалении строк, но карточки уходят каскадом, и порядок срабатывания
-- триггеров при каскаде полагаться не на что — отправляем явно.
insert into media_orphans (storage_path, user_id)
select m.storage_path, m.user_id
  from media m
  join cards c on c.id = m.card_id
 where c.user_id = auth.uid()
on conflict (storage_path) do update set marked_at = now();

insert into media_orphans (storage_path, user_id)
select m.thumb_path, m.user_id
  from media m
  join cards c on c.id = m.card_id
 where c.user_id = auth.uid()
on conflict (storage_path) do update set marked_at = now();

-- Дальше достаточно одной строки: scheduling, reviews, card_tags, media и
-- card_topics объявлены on delete cascade и уходят вместе с карточкой.
delete from cards where user_id = auth.uid();

commit;

-- Сколько осталось. Должно быть 0.
select count(*) as cards_left from cards where user_id = auth.uid();
