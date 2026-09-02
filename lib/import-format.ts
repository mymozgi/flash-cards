/**
 * Разбор вставленного содержимого.
 *
 * Приложение умело выгружать JSON и не умело прочитать его обратно — резервная
 * копия, которую нельзя восстановить, копией не является. Здесь и определение
 * формата, и приведение JSON к той же таблице, в которую PapaParse разбирает
 * CSV: дальше по мастеру идёт один и тот же путь, поэтому сопоставление
 * колонок, поиск дублей и предпросмотр не пришлось трогать вовсе.
 */

/** Колонки, которые понимает мастер импорта. */
export const CANONICAL_COLUMNS = [
  "front",
  "back",
  "topic",
  "tags",
  "note",
  "reversed",
  "choice1",
  "choice2",
  "choice3",
] as const;

export type Table = {
  headers: string[];
  rows: Record<string, string>[];
  /** Собственная выгрузка: колонки уже канонические, сопоставлять нечего. */
  fromExport: boolean;
};

export class ImportFormatError extends Error {}

/**
 * Формат определяется по первому непробельному символу, а не по расширению:
 * содержимое вставляют из буфера, и имени файла у него нет.
 */
export function sniffFormat(text: string): "json" | "csv" {
  const head = text.replace(/^﻿/, "").trimStart();
  return head.startsWith("{") || head.startsWith("[") ? "json" : "csv";
}

/** Значение любой формы — в ячейку таблицы. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(cell).filter(Boolean).join(", ");
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "object") return "";
  return String(value);
}

function isExportCard(value: unknown): boolean {
  return typeof value === "object" && value !== null && "front_md" in value;
}

/** Карточка собственной выгрузки — в канонические колонки мастера. */
function fromExportCard(card: Record<string, unknown>): Record<string, string> {
  const distractors = Array.isArray(card.distractors) ? card.distractors : [];
  return {
    front: cell(card.front_md),
    back: cell(card.back_md),
    topic: cell(card.topic_path),
    tags: cell(card.tags),
    note: cell(card.note_md),
    reversed: card.kind === "reversed_of" ? "1" : "0",
    choice1: cell(distractors[0]),
    choice2: cell(distractors[1]),
    choice3: cell(distractors[2]),
  };
}

/** Произвольный массив объектов: колонки собираются из ключей. */
function fromPlainArray(items: unknown[]): Table {
  const headers: string[] = [];
  const rows: Record<string, string>[] = [];

  for (const item of items) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const key of Object.keys(record)) {
      if (!headers.includes(key)) headers.push(key);
      row[key] = cell(record[key]);
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new ImportFormatError("The JSON has no objects to import — expected a list of cards.");
  }
  return { headers, rows, fromExport: false };
}

export function parseJson(text: string): Table {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new ImportFormatError(
      `That is not valid JSON: ${e instanceof Error ? e.message : "could not parse it"}`,
    );
  }

  if (Array.isArray(value)) return fromPlainArray(value);

  if (typeof value === "object" && value !== null) {
    const cards = (value as { cards?: unknown }).cards;
    if (Array.isArray(cards)) {
      // Собственная выгрузка узнаётся по полям карточки, а не по номеру версии:
      // версия могла не проставиться, а front_md есть с самого первого экспорта
      if (cards.some(isExportCard)) {
        const rows = cards
          .filter(isExportCard)
          .map((card) => fromExportCard(card as Record<string, unknown>));
        return { headers: [...CANONICAL_COLUMNS], rows, fromExport: true };
      }
      return fromPlainArray(cards);
    }
  }

  throw new ImportFormatError(
    "Expected a list of cards, or an export file with a “cards” list inside it.",
  );
}

/** Первые символы вставленного — чтобы отказ показывал, что именно прочитали. */
export function preview(text: string, limit = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}
