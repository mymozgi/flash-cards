-- Memorizer — форма дерева: Category → Topic → Flashcards.
--
-- Роли держались договорённостью: категория могла лежать в категории, тема —
-- в теме. Договорённость, которую не проверяют, перестаёт быть правдой
-- примерно через неделю. Здесь она становится правилом базы.
--
-- Правило:
--   area (категория) — только верхний уровень, внутри другой лежать не может;
--   deck (тема)      — внутри другой темы лежать не может;
--   карточка          — только в теме (это проверяет 0021).
--
-- ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ: запрета на тему верхнего уровня.
--
-- Первая версия этой миграции такой запрет содержала и падала на собственных
-- данных: набор, лежащий в корне и уже наполненный карточками, — это тема,
-- у которой ещё нет категории. Обратить её в категорию нельзя (карточкам
-- некуда деться), а выдумать ей категорию значило бы придумать за человека
-- имя, которого он не давал.
--
-- Поэтому тема без категории — законное переходное состояние: набор сделали
-- раньше, чем занялись раскладкой. Форму это не рушит, потому что запрещено
-- главное — вложенность одноимённых ролей.

-- Роль по месту. Корень БЕЗ собственных карточек — категория; корень с
-- карточками остаётся темой; ребёнок корня — тема.
--
-- Ни один узел не меняет родителя: переносится роль, а не данные.
update topics t set kind = 'area'
 where t.parent_id is null
   and t.kind <> 'source'
   and t.kind <> 'area'
   and not exists (
     select 1 from cards c
      where c.topic_id = t.id
        and c.deleted_at is null
   );

update topics t set kind = 'deck'
 where t.kind = 'area'
   and exists (
     select 1 from topics p
      where p.id = t.parent_id
        and p.parent_id is null
   );

/*
  Проверка формы.

  Стоит на insert и на смене родителя или роли — там, где форму можно
  нарушить. Узлы глубже второго уровня триггер не трогает, пока их не
  переносят: их переименование и раскраска работают по-прежнему.
*/
create or replace function topics_two_levels() returns trigger
language plpgsql as $$
declare
  parent_kind topic_kind;
begin
  if new.kind = 'source' then
    return new;
  end if;

  if new.kind = 'area' and new.parent_id is not null then
    raise exception 'A category lives at the top level, not inside another category';
  end if;

  if new.kind = 'deck' and new.parent_id is not null then
    select kind into parent_kind from topics where id = new.parent_id;
    if parent_kind = 'deck' then
      raise exception 'A topic cannot live inside another topic';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists topics_shape on topics;
create trigger topics_shape
  before insert or update of parent_id, kind on topics
  for each row execute function topics_two_levels();
