-- Flashcards — сводка по тегам для экрана статистики.
--
-- Считать в приложении значило бы тянуть все связи карточек с тегами ради
-- двух чисел на строку. security_invoker=on — представление наследует RLS
-- вызывающего, поэтому чужие карточки в подсчёт не попадут.

create or replace view tag_stats with (security_invoker = on) as
  select
    t.id                                            as tag_id,
    t.name                                          as name,
    count(*)::int                                   as total,
    count(*) filter (where s.state = 'review')::int as memorized
  from tags t
  join card_tags ct on ct.tag_id = t.id
  join cards c on c.id = ct.card_id and c.deleted_at is null
  left join scheduling s on s.card_id = c.id
  group by t.id, t.name;

grant select on tag_stats to authenticated;
