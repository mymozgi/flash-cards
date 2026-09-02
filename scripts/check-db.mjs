/**
 * Проверка того, что база готова к работе: `npm run check:db`
 *
 * Запускается с публичным ключом, то есть от лица гостя. Логика такая:
 * гость НЕ должен иметь доступа к таблицам — права выданы только роли
 * authenticated. Поэтому «отказано в доступе» здесь означает, что таблица
 * существует и закрыта правильно, а вот успешное чтение — это тревога.
 *
 * Необязательная сквозная проверка: задайте KARTOTEKA_EMAIL и KARTOTEKA_PASSWORD,
 * и скрипт войдёт под вашим аккаунтом, создаст тестовую карточку, убедится,
 * что триггер завёл ей расписание, и уберёт за собой.
 */
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "topics",
  "tags",
  "cards",
  "card_tags",
  "scheduling",
  "reviews",
  "settings",
  "media",
  "media_orphans",
  "import_batches",
];
const VIEWS = ["topic_card_counts"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ok = (m) => console.log(`  [32m✓[0m ${m}`);
const bad = (m) => console.log(`  [31m✗[0m ${m}`);
const warn = (m) => console.log(`  [33m![0m ${m}`);

if (!url || !key || key.length < 20 || url.includes("xxxxxxxxxxxx")) {
  bad("В .env.local не заполнены NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  console.log("    Supabase → Project Settings → API, скопируйте URL и публичный ключ.");
  process.exit(1);
}

const supabase = createClient(url, key);
let failures = 0;

console.log(`\nПроект: ${url}\n`);
console.log("Схема:");

for (const name of [...TABLES, ...VIEWS]) {
  // без head: при 401 PostgREST возвращает код ошибки только в теле ответа
  const { error, count } = await supabase.from(name).select("*", { count: "exact" }).limit(1);

  if (!error && (count ?? 0) > 0) {
    bad(`${name} — гость видит ${count} строк; RLS не защищает таблицу`);
    failures++;
  } else if (!error) {
    warn(`${name} — гостю выдан select, но строк он не видит; примените 0002_revoke_anon.sql`);
  } else if (error.code === "42501") {
    ok(`${name} — есть, доступ закрыт для гостя`);
  } else if (error.code === "42P01" || error.code === "PGRST205") {
    bad(`${name} — не найдена; выполните supabase/migrations/0001_init.sql`);
    failures++;
  } else {
    bad(`${name} — ${error.code || `HTTP ${error.status ?? "?"}`}: ${error.message || "без описания"}`);
    failures++;
  }
}


/**
 * Проверка расхождения схемы.
 *
 * Существование таблицы ничего не говорит о её колонках: приложение уже
 * падало на отсутствующем image_position, хотя таблица cards была на месте.
 * Здесь запрашиваются ровно те колонки, которые нужны коду, — недостающая
 * назовёт себя сама. Работает только под аккаунтом: гостю PostgREST
 * отвечает «доступ закрыт» ещё до разбора списка колонок.
 */
const REQUIRED_COLUMNS = {
  cards:
    "id,user_id,topic_id,front_md,back_md,note_md,example_md,kind,shape,layout,image_position,mcq,distractors,position,suspended,deleted_at,import_batch_id,front_norm,created_at,updated_at",
  topics: "id,user_id,parent_id,name,position,description,color,image_path,created_at",
  scheduling:
    "card_id,user_id,state,due,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,last_review",
  media: "id,user_id,card_id,side,storage_path,thumb_path,width,height,bytes,caption,position",
  settings: "user_id,daily_new_limit,daily_review_limit,request_retention,timezone,mcq_enabled,public_library",
  import_batches: "id,user_id,filename,row_count,created_count,skipped_count,error_count,status",
  topic_progress: "topic_id,total,memorized,last_used",
};

async function checkColumns(client) {
  console.log("");
  console.log("Колонки, которые нужны коду:");
  let broken = 0;

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    const { error } = await client.from(table).select(columns).limit(1);
    if (!error) {
      ok(`${table} — все ${columns.split(",").length} колонки на месте`);
      continue;
    }
    broken++;
    bad(`${table} — ${error.message}`);
    if (error.message.includes("schema cache") || error.code === "42703") {
      console.log("    Похоже, не применена одна из миграций в supabase/migrations/");
    }
  }
  return broken;
}

/**
 * Функции в базе. Проверяются пустым вызовом: порядок из нуля карточек
 * ничего не меняет, но отсутствие самой функции видно сразу — иначе непринятая
 * миграция всплывёт только когда пользователь переставит карточки.
 */
const REQUIRED_FUNCTIONS = [
  { name: "set_card_order", args: { p_topic_id: null, p_ids: [] }, file: "0013_card_order.sql" },
];

async function checkFunctions(client) {
  console.log("");
  console.log("Функции, которые нужны коду:");
  let broken = 0;

  for (const fn of REQUIRED_FUNCTIONS) {
    const { error } = await client.rpc(fn.name, fn.args);
    if (!error) {
      ok(`${fn.name} — на месте`);
      continue;
    }
    broken++;
    bad(`${fn.name} — ${error.message}`);
    console.log(`    Примените supabase/migrations/${fn.file}`);
  }
  return broken;
}

const email = process.env.KARTOTEKA_EMAIL;
const password = process.env.KARTOTEKA_PASSWORD;

if (email && password) {
  console.log("\nСквозная проверка под вашим аккаунтом:");
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    bad(`вход не удался — ${authError.message}`);
    failures++;
  } else {
    ok(`вход выполнен: ${auth.user.email}`);
    failures += await checkColumns(supabase);
    failures += await checkFunctions(supabase);
    console.log("");
    const userId = auth.user.id;
    let cardId = null;

    try {
      const { data: card, error: cardError } = await supabase
        .from("cards")
        .insert({
          user_id: userId,
          front_md: "проверка связи",
          back_md: "работает",
        })
        .select("id")
        .single();
      if (cardError) throw new Error(`создание карточки — ${cardError.message}`);
      cardId = card.id;
      ok("карточка создаётся");

      const { data: sched, error: schedError } = await supabase
        .from("scheduling")
        .select("state,due")
        .eq("card_id", cardId)
        .single();
      if (schedError || !sched) throw new Error("триггер не завёл строку расписания");
      ok(`триггер расписания сработал: состояние «${sched.state}»`);

      const { error: searchError } = await supabase
        .from("cards")
        .select("id")
        .textSearch("search", "проверка", { config: "russian" })
        .limit(1);
      if (searchError) throw new Error(`полнотекстовый поиск — ${searchError.message}`);
      ok("полнотекстовый поиск отвечает");
    } catch (e) {
      bad(e instanceof Error ? e.message : String(e));
      failures++;
    } finally {
      if (cardId) {
        await supabase.from("cards").delete().eq("id", cardId);
        ok("тестовая карточка удалена");
      }
      await supabase.auth.signOut();
    }
  }
} else {
  console.log(
    "\nСверка колонок и сквозная проверка пропущены: задайте KARTOTEKA_EMAIL и KARTOTEKA_PASSWORD.",
  );
  warn("расхождение схемы без входа не проверяется — гостя отсекают раньше колонок");
}

console.log(
  failures === 0
    ? "\n[32mВсё готово — можно запускать npm run dev.[0m\n"
    : `\n[31mПроблем: ${failures}. См. README.md, раздел «Запуск».[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
