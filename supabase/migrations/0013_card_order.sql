-- Memorizer — порядок карточек одним запросом.
--
-- Раньше перестановка сохранялась циклом: по одному UPDATE на карточку. На
-- наборе в шестьдесят карточек это шестьдесят обращений к базе, и обрыв
-- посередине оставлял половину порядка сохранённой, а половину — нет.
-- Здесь всё происходит в одном вызове и одной транзакции: либо новый порядок
-- целиком, либо прежний целиком.
--
-- security invoker — функция выполняется с правами вызывающего, поэтому RLS
-- на cards продолжает работать и чужие карточки переставить нельзя.

create or replace function set_card_order(p_topic_id uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
as $$
declare
  touched integer;
begin
  update cards c
     set position = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where c.id = o.id
     and c.topic_id = p_topic_id
     and c.user_id = (select auth.uid())
     and c.deleted_at is null;

  get diagnostics touched = row_count;
  return touched;
end $$;

grant execute on function set_card_order(uuid, uuid[]) to authenticated;
revoke execute on function set_card_order(uuid, uuid[]) from anon;
