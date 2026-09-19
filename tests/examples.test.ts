import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { CANONICAL_COLUMNS } from "@/lib/import-format";
import { splitTopicPath } from "@/lib/knowledge-tree";
import { normalizeFront } from "@/lib/cards";
import { renderMarkdown } from "@/lib/markdown";

/*
  Примеры в examples/ — это не документация, а входные данные: их берут и
  скармливают мастеру импорта. Файл с колонкой удалённой функции или с путём,
  который в двухуровневой модели не раскладывается, учит неправильному формату
  молча. Разбор здесь настроен ровно так же, как в мастере.
*/

const DIR = join(__dirname, "..", "examples");
const files = readdirSync(DIR).filter((name) => name.endsWith(".csv"));

function rowsOf(name: string) {
  const text = readFileSync(join(DIR, name), "utf8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
  });
  return { result, rows: result.data };
}

it("в examples/ вообще есть примеры", () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(files)("%s", (name) => {
  const { result, rows } = rowsOf(name);

  it("разбирается без ошибок", () => {
    expect(result.errors).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("все колонки канонические — сопоставлять руками не придётся", () => {
    const headers = (result.meta.fields ?? []).filter(Boolean);
    const unknown = headers.filter(
      (h) => !(CANONICAL_COLUMNS as readonly string[]).includes(h),
    );
    expect(unknown).toEqual([]);
  });

  it("у каждой строки есть вопрос, ответ и тема", () => {
    const broken = rows.filter((r) => !r.front?.trim() || !r.back?.trim() || !r.topic?.trim());
    expect(broken).toEqual([]);
  });

  it("каждый путь раскладывается в категорию и тему", () => {
    // Односегментный путь создал бы тему без категории: законно в базе, но в
    // примере это просто забытая категория.
    const flat = rows
      .map((r) => r.topic.trim())
      .filter((path) => {
        const { category, topic } = splitTopicPath(path);
        return !category || !topic;
      });
    expect([...new Set(flat)]).toEqual([]);
  });

  it("имя категории не содержит разделитель пути", () => {
    // Защита от «XR / VR / AR»: слэш внутри имени разрывает путь.
    const deep = rows.map((r) => r.topic.split("/").length).filter((n) => n !== 2);
    expect(deep).toEqual([]);
  });

  it("вопросы не повторяются — иначе импорт спросит про дубли", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const row of rows) {
      const key = normalizeFront(row.front);
      if (seen.has(key)) dupes.push(row.front);
      else seen.set(key, row.front);
    }
    expect(dupes).toEqual([]);
  });
  it("текст не превращается в разметку случайно", () => {
    /*
      `is_admin or user_id` рендерер читал как курсив: правило `_…_` не знает,
      что это идентификатор. Ни одна карточка в примерах курсива не просит,
      поэтому появление <em> или <strong> — всегда случайность.
      Лечится обратными кавычками: код разбирается раньше выделения.
    */
    const mangled = rows
      .flatMap((r) => [r.front, r.back, r.note])
      .filter(Boolean)
      .filter((text) => /<(em|strong)>/.test(renderMarkdown(text)));
    expect(mangled).toEqual([]);
  });
});
