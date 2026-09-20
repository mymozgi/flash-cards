-- Memorizer — какие миграции уже применены.
--
-- ЭТО НЕ МИГРАЦИЯ. Ничего не меняет, только читает системный каталог.
-- Запускать в SQL-редакторе Supabase, когда непонятно, на чём остановились.
--
-- Смотрим на объекты, а не на журнал: журнала применённых миграций здесь нет,
-- файлы выполняются руками. Существование объекта — единственное честное
-- свидетельство того, что файл прошёл.

select *
from (
  values
    ('0013  порядок карточек',
     to_regprocedure('set_card_order(uuid,uuid[])') is not null),

    ('0015  icon / archived_at / kind у темы',
     exists (select 1 from information_schema.columns
              where table_name = 'topics' and column_name = 'kind')),

    ('0016  глубина дерева и защита от цикла',
     to_regprocedure('topics_depth_guard()') is not null),

    ('0017  счётчики по всей ветке',
     to_regclass('public.topic_rollup') is not null),

    ('0018  источник карточки (link_url)',
     exists (select 1 from information_schema.columns
              where table_name = 'cards' and column_name = 'link_url')),

    ('0019  карточка в нескольких категориях',
     to_regclass('public.card_topics') is not null),

    ('0020  род узла: значение deck в enum',
     exists (select 1 from pg_enum e
              join pg_type t on t.oid = e.enumtypid
             where t.typname = 'topic_kind' and e.enumlabel = 'deck')),

    ('0021  карточка только в группе',
     exists (select 1 from pg_trigger where tgname = 'cards_topic_kind')),

    ('0022  форма дерева Category → Topic → Cards',
     exists (select 1 from pg_trigger where tgname = 'topics_shape')),

    ('0023  теги удалены',
     to_regclass('public.tags') is null)
) as t(миграция, применена)
order by миграция;
