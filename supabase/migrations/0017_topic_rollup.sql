-- Memorizer — счётчики по всей ветке, а не по прямым детям.
--
-- Существующая вьюха topic_card_counts считает карточки, лежащие
-- непосредственно в узле. Для списка категорий этого мало: «Psychology —
-- 42 items» это вся ветка целиком, включая Cognitive Biases и всё, что под
-- ними. Считать такое в приложении значило бы тянуть всё дерево и все
-- карточки ради двух чисел на строку.
--
-- security_invoker = on — представление наследует RLS вызывающего, поэтому
-- рекурсия не выходит за пределы своих данных.

create or replace view topic_rollup with (security_invoker = on) as
  with recursive branch as (
    -- каждый узел сам себе корень: так одним проходом получаем и «сколько
    -- под Psychology», и «сколько под Cognitive Biases»
    select id as root, id as node, user_id from topics
    union all
    select b.root, child.id, b.user_id
      from branch b
      join topics child on child.parent_id = b.node
  )
  select
    b.root                                            as topic_id,
    b.user_id                                         as user_id,
    count(distinct c.id)::int                         as cards,
    (count(distinct b.node) - 1)::int                 as descendants
  from branch b
  left join cards c
    on c.topic_id = b.node
   and c.deleted_at is null
  group by b.root, b.user_id;

grant select on topic_rollup to authenticated;
revoke all on topic_rollup from anon;
