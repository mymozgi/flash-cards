-- Memorizer — форма дерева закрепляется: Category → Topic → Flashcards.
--
-- Ролей у узла две, и до сих пор они держались договорённостью: категория
-- могла лежать в категории, группа — в группе, и ничто этому не мешало.
-- Договорённость, которую не проверяют, перестаёт быть правдой примерно
-- через неделю.
--
-- Правило простое:
--   area (категория) — только верхний уровень;
--   deck (тема)      — только внутри категории;
--   карточка          — только в теме (это уже проверяет 0021).
--
-- Перенос НЕ двигает данные. Он только расставляет роль по месту, которое
-- узел уже занимает: корень становится категорией, ребёнок корня — темой.
-- Ни один узел не меняет родителя.

-- Роль по глубине. Узлы глубже второго уровня остаются как есть: трогать их
-- значило бы перемещать чужие данные без спроса.
update topics set kind = 'area'
 where parent_id is null and kind <> 'source';

update topics t set kind = 'deck'
 where t.kind <> 'source'
   and exists (
     select 1 from topics p
      where p.id = t.parent_id
        and p.parent_id is null
   );

/*
  Проверка формы.

  Стоит на insert и на смене родителя или роли — то есть ровно там, где форму
  можно нарушить. Существующие узлы глубже двух уровней переименовывать и
  красить можно по-прежнему: триггер не трогает то, что не двигают.
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

  if new.kind = 'deck' then
    if new.parent_id is null then
      raise exception 'A topic lives inside a category';
    end if;
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
