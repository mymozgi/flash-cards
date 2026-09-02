-- Memorizer — цвет тега.
--
-- Хранится НОМЕР ЯЧЕЙКИ палитры (0–5), а не произвольный HEX. Причина
-- измеримая: шесть оттенков в app/globals.css проверены скриптом валидации на
-- различимость при дальтонизме — худшая соседняя пара даёт ΔE 9,1 в светлой
-- теме и 8,4 в тёмной при пороге 8. Свободный выбор цвета эту проверку
-- отменяет: два тега смогут оказаться в 2 ΔE друг от друга и слиться. Так уже
-- провалился вариант круговой диаграммы на четырёх оттенках — фиолетовый и
-- синий разошлись на 1,9.
--
-- Цена решения названа честно: различимых цветов шесть. Седьмому тегу цвет
-- придётся повторить или оставить его нейтральным.
--
-- Файл самодостаточен: определение вьюхи tag_stats приведено целиком, поэтому
-- его можно применить и без 0011 — она будет создана здесь же.

alter table tags add column if not exists color smallint
  check (color is null or (color >= 0 and color <= 5));

comment on column tags.color is
  'Номер ячейки категориальной палитры (0-5). NULL — нейтральный тег.';

-- Сводка по тегам теперь несёт и цвет: без него экран статистики красил бы
-- теги по месту в рейтинге, и один и тот же тег был бы разного цвета на
-- карточке и в статистике.
create or replace view tag_stats with (security_invoker = on) as
  select
    t.id                                            as tag_id,
    t.name                                          as name,
    t.color                                         as color,
    count(*)::int                                   as total,
    count(*) filter (where s.state = 'review')::int as memorized
  from tags t
  join card_tags ct on ct.tag_id = t.id
  join cards c on c.id = ct.card_id and c.deleted_at is null
  left join scheduling s on s.card_id = c.id
  group by t.id, t.name, t.color;

grant select on tag_stats to authenticated;
