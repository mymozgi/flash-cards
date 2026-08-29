-- Картотека — ужесточение прав.
--
-- Supabase по умолчанию выдаёт роли anon право select на новые таблицы в public.
-- Строки и так закрыты политиками RLS (они написаны для authenticated), но
-- приложению на одного пользователя гость у таблиц не нужен вовсе: до входа
-- клиент обращается только к эндпоинтам авторизации, не к PostgREST.
--
-- После этой миграции запрос без сессии получает 42501 «permission denied»
-- ещё до того, как дело дойдёт до RLS.

do $$
declare t text;
begin
  foreach t in array array[
    'topics','tags','cards','card_tags','scheduling','reviews','settings','topic_card_counts'
  ]
  loop
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

revoke all on sequence reviews_id_seq from anon;

-- новые объекты в public тоже не должны доставаться гостю
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
