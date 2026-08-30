-- Картотека — рабочее пространство колоды.
--
-- Карточка получает два необязательных поля из макета — пример употребления
-- и ссылку на источник, — а также собственный переключатель режима выбора
-- ответа: он нужен на самой карточке, а не только в общих настройках.

alter table cards add column example_md text;
alter table cards add column link_url  text;
alter table cards add column mcq       boolean not null default false;

-- Тема в интерфейсе работает как колода: у неё есть описание и обложка.
alter table topics add column description text;
alter table topics add column color       text;
alter table topics add column image_path  text;

-- Ссылка должна быть ссылкой, а не произвольным текстом: поле попадает
-- в разметку карточки, и http(s) здесь единственная безопасная схема.
alter table cards add constraint cards_link_url_check
  check (link_url is null or link_url ~* '^https?://');

-- Поиск теперь охватывает и пример: колонка генерируемая, поэтому
-- пересоздаём её целиком.
alter table cards drop column search;
alter table cards add column search tsvector generated always as
  (to_tsvector('russian',
     coalesce(front_md, '')   || ' ' ||
     coalesce(back_md, '')    || ' ' ||
     coalesce(note_md, '')    || ' ' ||
     coalesce(example_md, ''))) stored;

create index cards_search_idx on cards using gin (search);
