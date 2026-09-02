-- Memorizer — глубина дерева и защита от петли.
--
-- Прежний триггер ограничивал дерево тремя уровнями: этого хватало, пока темы
-- были подписью к колоде. Для раздела Knowledge мало — «Psychology → Cognitive
-- Biases → Decision Making → Anchoring» это уже четыре.
--
-- Предел поднят до шести, а не снят вовсе, и причина не техническая: дерево,
-- которое не помещается на экран по горизонтали, перестаёт быть картой и
-- становится лабиринтом. Упрётесь — поднять можно одной строкой.
--
-- Заодно закрыта дыра, которой раньше не было видно. Прежний обход шёл вверх
-- по родителям и на петле (узел стал потомком самого себя) крутился бы вечно,
-- вешая запрос. Пока родителя выбирали из выпадающего списка, это было
-- умозрительно. С перетаскиванием — вопрос одного промаха мышью.

create or replace function topics_depth_guard() returns trigger
language plpgsql as $$
declare
  depth int := 1;
  p uuid := new.parent_id;
  seen uuid[] := array[new.id];
begin
  while p is not null loop
    if p = any(seen) then
      raise exception 'A category cannot be placed inside itself';
    end if;
    seen := seen || p;

    depth := depth + 1;
    if depth > 6 then
      raise exception 'The category tree is limited to six levels';
    end if;

    select parent_id into p from topics where id = p;
  end loop;
  return new;
end $$;
