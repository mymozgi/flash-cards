-- Картотека — этап 3: батч-импорт из CSV и варианты ответа.

-- Неправильные варианты для режима выбора ответа. Задаются вручную —
-- при создании карточки или колонками choice1..choice3 в CSV.
alter table cards add column distractors text[] not null default '{}';

-- Режим выбора ответа включается тумблером в настройках; карточки без
-- вариантов показываются обычным способом даже когда режим включён.
alter table settings add column mcq_enabled boolean not null default false;

-- Журнал импортов: нужен для отчёта и для отката в течение суток (FR-38).
create table import_batches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  filename      text not null,
  row_count     int  not null default 0,
  created_count int  not null default 0,
  skipped_count int  not null default 0,
  error_count   int  not null default 0,
  status        text not null default 'running',
  created_at    timestamptz not null default now()
);
create index import_batches_user_idx on import_batches (user_id, created_at desc);

-- cards.import_batch_id заведён ещё в 0001, но без внешнего ключа:
-- теперь связь можно закрепить и откатывать импорт одним запросом
create index cards_import_batch_idx on cards (import_batch_id) where import_batch_id is not null;

alter table import_batches enable row level security;

create policy import_batches_owner on import_batches for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on import_batches to authenticated;
revoke all on import_batches from anon;
