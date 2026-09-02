-- Memorizer — полная очистка содержимого: карточки И дерево категорий.
--
-- ЭТО НЕ МИГРАЦИЯ. Запускать только намеренно.
--
-- Отличие от reset_cards.sql: здесь сносится и структура — категории и темы.
-- Нужно, когда дерево накопило мусор и проще собрать его заново, чем
-- разбирать. Теги, настройки и аккаунт остаются.
--
-- Восстановить удалённое нельзя.

begin;

insert into media_orphans (storage_path, user_id)
select m.storage_path, m.user_id from media m
  join cards c on c.id = m.card_id where c.user_id = auth.uid()
on conflict (storage_path) do update set marked_at = now();

insert into media_orphans (storage_path, user_id)
select m.thumb_path, m.user_id from media m
  join cards c on c.id = m.card_id where c.user_id = auth.uid()
on conflict (storage_path) do update set marked_at = now();

-- Обложки категорий тоже в уборку: у них своя ветка в хранилище
insert into media_orphans (storage_path, user_id)
select t.image_path, t.user_id from topics t
 where t.user_id = auth.uid() and t.image_path is not null
on conflict (storage_path) do update set marked_at = now();

delete from cards  where user_id = auth.uid();
delete from topics where user_id = auth.uid();

commit;

select
  (select count(*) from cards  where user_id = auth.uid()) as cards_left,
  (select count(*) from topics where user_id = auth.uid()) as topics_left;
