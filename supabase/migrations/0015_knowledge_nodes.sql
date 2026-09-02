-- Memorizer — раздел Knowledge, слой над существующим деревом.
--
-- Новых сущностей здесь нет и не нужно: таблица topics уже является деревом
-- произвольной формы с родителем, порядком, описанием и цветом. Category,
-- Subcategory и Topic из задания — это один и тот же узел на разных уровнях.
-- Не хватало ровно трёх вещей.

-- Иконка категории. Одно-два эмодзи, а не путь к файлу: узнаваемость нужна
-- мгновенная и в списке, и на карте, а хранилище ограничено гигабайтом.
alter table topics add column if not exists icon text
  check (icon is null or length(icon) <= 8);

-- Архив — третье состояние между «есть» и «удалено». Категория исчезает из
-- списков и с карты, но карточки остаются на месте и продолжают приходить на
-- повторение. Это ответ на «я больше не структурирую по этой оси», а не на
-- «мне это не нужно».
alter table topics add column if not exists archived_at timestamptz;

-- Вид узла. Область знания и источник живут в одном дереве, потому что связь
-- карточки с ними одинаковая, но показывать их вперемешку нельзя: «Psychology»
-- и «Thinking, Fast and Slow» отвечают на разные вопросы.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'topic_kind') then
    create type topic_kind as enum ('area', 'source');
  end if;
end $$;

alter table topics add column if not exists kind topic_kind not null default 'area';

comment on column topics.icon        is 'Эмодзи-иконка категории.';
comment on column topics.archived_at is 'Убрана из списков, содержимое не тронуто.';
comment on column topics.kind        is 'area — область знания, source — источник (книга, курс).';

create index if not exists topics_active_idx on topics (user_id, kind, position)
  where archived_at is null;
