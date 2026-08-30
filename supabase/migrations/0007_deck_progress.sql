-- Картотека — сводка по колоде для списка наборов.
--
-- Считать это на клиенте значило бы тянуть все карточки ради трёх чисел.
-- security_invoker=on — представление наследует RLS вызывающего.

create view topic_progress with (security_invoker = on) as
  select
    c.topic_id,
    count(*)::int                                          as total,
    -- «выучено» = карточка дошла до фазы повторения: она уже пережила
    -- этап изучения и переучивания, и FSRS даёт ей интервал в днях
    count(*) filter (where s.state = 'review')::int         as memorized,
    max(s.last_review)                                      as last_used
  from cards c
  left join scheduling s on s.card_id = c.id
  where c.deleted_at is null
  group by c.topic_id;

grant select on topic_progress to authenticated;
revoke all on topic_progress from anon;
