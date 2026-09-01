-- Flashcards — гостевой доступ на чтение.
--
-- Гость видит библиотеку, но не может ничего изменить. Граница проходит по
-- правам в базе, а не по спрятанным кнопкам: роли anon выдаётся только select
-- и только пока владелец включил общий доступ. Право на запись не выдаётся
-- вовсе, поэтому подделать запрос мимо интерфейса не выйдет.

alter table settings add column public_library boolean not null default false;

-- Чтение открыто, лишь пока в настройках владельца стоит флаг. Выключили —
-- гость мгновенно теряет доступ, без миграций и передеплоев.
create or replace function library_is_public(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public_library from settings where user_id = owner), false);
$$;

do $$
declare t text;
begin
  foreach t in array array['topics', 'cards', 'card_tags', 'tags', 'media']
  loop
    execute format(
      'create policy %1$s_public_read on %1$s for select to anon
         using (library_is_public(user_id))', t);
    execute format('grant select on %1$s to anon', t);
  end loop;
end $$;

-- Представление наследует RLS вызывающего, поэтому отдельной политики
-- не требует — достаточно права на чтение
grant select on topic_progress to anon;

-- Настройки гостю не отдаём целиком: лимиты и часовой пояс его не касаются.
-- Функция сама читает нужную строку под своими правами.
grant execute on function library_is_public(uuid) to anon;
