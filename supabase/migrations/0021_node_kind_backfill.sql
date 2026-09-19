  -- Memorizer — расстановка рода у существующих узлов.
  --
  -- Отдельным файлом от 0020: значение enum, добавленное в той же транзакции,
  -- использовать нельзя — Postgres об этом прямо сообщает. Выполнять строго
  -- после 0020.
  --
  -- Правило переноса — ровно то, по которому приложение до сих пор угадывало:
  -- узел со своими карточками был колодой, остальные были категориями. Так
  -- нынешняя картина сохраняется в точности, и ни один экран не меняет вида
  -- в момент миграции.

  update topics t
    set kind = 'deck'
  where t.kind = 'area'
    and exists (
      select 1 from cards c
        where c.topic_id = t.id
          and c.deleted_at is null
    );

  -- Лист без карточек — тоже колода: категорию создают, чтобы вложить в неё
  -- группы, а пустой лист заводят, чтобы сейчас же наполнить карточками.
  update topics t
    set kind = 'deck'
  where t.kind = 'area'
    and not exists (select 1 from topics c where c.parent_id = t.id);

  /*
    Карточка может лежать только в группе, но не в категории.

    Проверка стоит в базе, а не только в интерфейсе: правило структурное, и
    обойти его можно любым другим клиентом. Оно же ловит обратный случай —
    попытку превратить непустую колоду в категорию.
  */
  create or replace function cards_require_deck() returns trigger
  language plpgsql as $$
  declare
    target topic_kind;
  begin
    if new.topic_id is null then
      return new;
    end if;
    select kind into target from topics where id = new.topic_id;
    if target = 'area' then
      raise exception 'Cards live in a flashcard group, not in a category';
    end if;
    return new;
  end $$;

  drop trigger if exists cards_topic_kind on cards;
  create trigger cards_topic_kind
    before insert or update of topic_id on cards
    for each row execute function cards_require_deck();

  create or replace function topics_keep_deck_kind() returns trigger
  language plpgsql as $$
  begin
    if new.kind = 'area' and old.kind <> 'area'
      and exists (select 1 from cards c where c.topic_id = new.id and c.deleted_at is null)
    then
      raise exception 'Move the cards out before turning this into a category';
    end if;
    return new;
  end $$;

  drop trigger if exists topics_kind_guard on topics;
  create trigger topics_kind_guard
    before update of kind on topics
    for each row execute function topics_keep_deck_kind();
