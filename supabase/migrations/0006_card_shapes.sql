-- Картотека — формат карточки и порядок в колоде.

-- Три пропорции. Выбор не случайный:
--   square    1:1 — универсальная, одинаково смотрится и на телефоне, и на столе
--   landscape 3:2 — под широкие схемы, графики, скриншоты интерфейсов
--   portrait  2:3 — под текст с картинкой: на телефоне занимает экран целиком
-- 16:9 сознательно не берём: на узком экране такая карточка вырождается в полоску.
create type card_shape as enum ('square', 'landscape', 'portrait');

alter table cards add column shape card_shape not null default 'square';

-- Порядок внутри колоды задаётся вручную перетаскиванием. До сих пор карточки
-- шли по дате создания, а это не то же самое, что осмысленная последовательность.
alter table cards add column position int not null default 0;
create index cards_topic_position_idx on cards (topic_id, position);

-- Существующим карточкам раздаём порядок по дате, чтобы они не слиплись в нули
with ordered as (
  select id, row_number() over (partition by topic_id order by created_at) - 1 as rn
  from cards
)
update cards set position = ordered.rn
from ordered
where cards.id = ordered.id;
