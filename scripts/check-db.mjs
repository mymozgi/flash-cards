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
    "\nСквозная проверка пропущена. Чтобы включить, задайте KARTOTEKA_EMAIL и KARTOTEKA_PASSWORD.",
  );
}

console.log(
  failures === 0
    ? "\n[32mВсё готово — можно запускать npm run dev.[0m\n"
    : `\n[31mПроблем: ${failures}. См. README.md, раздел «Запуск».[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
