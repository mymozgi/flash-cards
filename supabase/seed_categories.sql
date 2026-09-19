-- Memorizer — четыре новые категории.
--
-- ЭТО НЕ МИГРАЦИЯ. Файл не входит в нумерацию и сам собой не выполняется:
-- он добавляет содержимое, а не меняет схему. Запускать в SQL-редакторе
-- Supabase под своим аккаунтом — `auth.uid()` подставится сам.
--
-- Категории создаются пустыми: карточка живёт только в теме, а тему удобнее
-- завести из интерфейса или дать импорту CSV создать её самому по пути
-- «Electricity / Ohm's law».
--
-- Цвета взяты из проверенной палитры (`app/(app)/knowledge/starters.ts`):
-- эти шесть оттенков различимы при дальтонизме, произвольный HEX такой
-- проверки не проходил.
--
-- Повторный запуск безопасен: имя узла уникально среди братьев, и совпадение
-- просто пропускается.

insert into topics (user_id, parent_id, name, icon, color, description, kind, position)
select
  auth.uid(),
  null,
  seed.name,
  seed.icon,
  seed.color,
  seed.description,
  'area',
  -- дописываем в конец списка, а не в начало: порядок, который пользователь
  -- уже выстроил, трогать нельзя
  coalesce((select max(position) from topics where user_id = auth.uid() and parent_id is null), -1)
    + seed.ord
from (values
  (1, 'Electricity', '⚡', '#eda100',
   'Current, voltage, resistance, circuits — the basics you keep forgetting.'),
  (2, 'Security',    '🔐', '#2a78d6',
   'APIs, OAuth, tokens, threat models — what a security engineer is expected to know.'),
  (3, 'XR / VR / AR', '🥽', '#e87ba4',
   'Spatial concepts, interaction rules and building software for headsets.'),
  (4, 'Robotics',    '🤖', '#1baf7a',
   'Kinematics, sensors, control loops and the software that drives them.')
) as seed(ord, name, icon, color, description)
on conflict on constraint topics_sibling_name_key do nothing;

-- Что получилось
select name, icon, color, kind, position
  from topics
 where user_id = auth.uid()
   and parent_id is null
 order by position;
