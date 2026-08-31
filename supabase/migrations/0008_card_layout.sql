-- Картотека — раскладка карточки.
--
-- full_image: изображение занимает полотно целиком, текст лежит поверх него
-- split:      полотно делится на половину с изображением и половину с текстом,
--             сторона задаётся image_position

create type card_layout as enum ('full_image', 'split');
create type image_position as enum ('left', 'right', 'top', 'bottom');

alter table cards add column layout         card_layout    not null default 'split';
alter table cards add column image_position image_position not null default 'top';
