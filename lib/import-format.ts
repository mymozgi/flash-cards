/**
 * Разбор вставленного содержимого.
 *
 * Приложение умело выгружать JSON и не умело прочитать его обратно — резервная
 * копия, которую нельзя восстановить, копией не является. Здесь и определение
 * формата, и приведение JSON к той же таблице, в которую PapaParse разбирает
 * CSV: дальше по мастеру идёт один и тот же путь, поэтому сопоставление
 * колонок, поиск дублей и предпросмотр не пришлось трогать вовсе.
 */

import { splitTopicPath } from "./knowledge-tree";

/**
 * Колонки, которые понимает мастер импорта.
 *
 * Место карточки описывают две колонки, а не одна: `category` — верхний
 * уровень, `area` — коллекция внутри него. Так файл сам раскладывает карточки
 * по коллекциям, и «XR / Comfort» с «XR / Hand tracking» в одном файле дают
 * две коллекции, а не одну с длинным именем.
 *
 * `topic` оставлена и понимается по-прежнему: там лежит тот же адрес одной
 * строкой, «Category / Area». Старые выгрузки должны читаться обратно —
 * резервная копия, которую нельзя восстановить, копией не является.
 */
export const CANONICAL_COLUMNS = [
  "front",
  "back",
  "category",
  "area",
  "topic",
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
  /*
    В выгрузке адрес лежит одной строкой. Разбираем его на пару колонок тем
    же правилом, что и всё остальное приложение, — иначе своя же выгрузка
    читалась бы обратно по запасному пути, а не по основному.
  */
  const place = splitTopicPath(cell(card.topic_path));
  return {
    front: cell(card.front_md),
    back: cell(card.back_md),
    category: place.category ?? "",
    area: place.topic ?? "",
    topic: cell(card.topic_path),
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

/* ────────────────────────────── куда кладём ────────────────────────────── */

/**
 * Откуда берётся категория для импортируемых карточек.
 *
 * `file` — путь берётся из файла как есть; `single` — всё уходит в одну
 * выбранную категорию, а из файла остаётся только имя темы внутри неё.
 */
export type DestinationMode = "file" | "single";

/**
 * Куда попадёт строка.
 *
 * Правило чистое и живёт здесь, а не в мастере, по той же причине, что и
 * остальные правила проекта: увидеть, куда лягут карточки, нужно ДО записи,
 * а проверить это можно только тестом.
 *
 * В режиме `single` категория из файла заменяется выбранной намеренно — в том
 * и смысл выбора. Имя темы при этом сохраняется: терять его значило бы свалить
 * весь файл в одну кучу.
 */
/**
 * Две колонки — в один адрес.
 *
 * Пустая категория законна: коллекция без категории — переходное состояние,
 * которое база разрешает. Пустая area означает, что раскладку задаёт не эта
 * пара колонок, и адрес придёт из `topic`.
 */
export function combinePath(category: string, area: string): string {
  const parts = [category.trim(), area.trim()].filter(Boolean);
  return parts.join(" / ");
}

/**
 * Адрес строки до выбора назначения: пара колонок, если она заполнена, иначе
 * старая колонка с путём. Приоритет у пары — она точнее: в ней разделитель не
 * может случайно оказаться внутри имени.
 */
export function rowPath(category: string, area: string, topic: string): string {
  /*
    Решает наличие КОЛЛЕКЦИИ, а не категории. Одна категория адреса не
    задаёт: карточка живёт в коллекции, и «XR» без неё завело бы набор с
    именем категории прямо в корне — ровно то, чего быть не должно.
  */
  if (!area.trim()) return topic.trim();
  return combinePath(category, area);
}

export function importDestination(
  topic: string,
  mode: DestinationMode,
  category: string | null,
  /** Тема для строк, у которых её нет: карточка не может лежать в категории. */
  fallbackDeck: string,
): string {
  const own = topic.trim();
  if (mode === "file" || !category) return own;

  const { topic: deck } = splitTopicPath(own);
  const name = deck ?? fallbackDeck.trim();
  return name ? `${category} / ${name}` : category;
}

/**
 * Есть ли в самом файле категории. Если нет, выбор «оставить как в файле»
 * предлагать не за чем: он оставил бы темы в корне, без категории вовсе.
 */
export function fileHasCategories(topics: string[]): boolean {
  return topics.some((t) => splitTopicPath(t).category !== null);
}

/** Имя набора по умолчанию — из имени файла, без расширения и мусора. */
export function deckNameFromFile(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  return base || "Imported";
}
