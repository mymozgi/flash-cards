"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  normalizeFront,
  resolveTopicPath,
} from "@/lib/cards";
import { createCategory } from "../knowledge/actions";
import { safeUrl } from "@/lib/url";

/**
 * Строка импорта — ровно то, чем карточка бывает в CSV.
 *
 * Обратных карточек и неправильных вариантов здесь больше нет. Обратная
 * карточка удваивала импорт вдвое молча, а варианты ответа собирались в
 * колонку, которую экран повторения до сих пор не показывает: импортировать
 * то, чего не видно, значит заполнять базу невидимым.
 */
export type ImportRow = {
  /** номер строки в исходном файле — попадает в отчёт об ошибках */
  line: number;
  front: string;
  back: string;
  /** Готовый адрес «Категория / Набор». Собирает его мастер. */
  topic: string;
  note: string;
  example: string;
  /** Читаемое имя источника: название книги, главы, лекции. */
  source: string;
  /** Адрес источника. Схему проверяет и база, и safeUrl(). */
  sourceUrl: string;
};

export type DuplicateStrategy = "skip" | "update" | "create";

export type BatchResult = {
  created: number;
  skipped: number;
  errors: { line: number; reason: string }[];
};

const TRUTHY = new Set(["1", "true", "yes", "y", "да", "истина"]);

export async function parseFlag(value: string): Promise<boolean> {
  return TRUTHY.has(value.trim().toLowerCase());
}

export async function startImport(filename: string, rowCount: number): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("import_batches")
    .insert({ user_id: user.id, filename: filename.slice(0, 200), row_count: rowCount })
    .select("id")
    .single();

  if (error) throw new Error(`Could not start the import: ${error.message}`);
  return data.id as string;
}

/**
 * Какие из присланных лицевых сторон уже есть в базе. Сравнение идёт по
 * нормализованному тексту — тому же, что лежит в генерируемой колонке
 * cards.front_norm, поэтому регистр и знаки препинания роли не играют.
 */
export async function findDuplicates(fronts: string[]): Promise<string[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const normalized = [...new Set(fronts.map(normalizeFront).filter(Boolean))];
  if (normalized.length === 0) return [];

  const found = new Set<string>();
  for (let i = 0; i < normalized.length; i += 200) {
    const { data } = await supabase
      .from("cards")
      .select("front_norm")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("front_norm", normalized.slice(i, i + 200));
    for (const row of (data ?? []) as { front_norm: string }[]) found.add(row.front_norm);
  }
  return [...found];
}

/**
 * Одна порция строк. Клиент шлёт их пачками по сотне: так виден прогресс,
 * и большой файл не упирается в лимит времени серверной функции (§13).
 */
export async function importRows(
  batchId: string,
  rows: ImportRow[],
  strategy: DuplicateStrategy,
): Promise<BatchResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const result: BatchResult = { created: 0, skipped: 0, errors: [] };

  const topicCache = new Map<string, string | null>();

  // существующие карточки ищем один раз на всю порцию, а не построчно
  const norms = rows.map((r) => normalizeFront(r.front)).filter(Boolean);
  const existing = new Map<string, string>();
  if (norms.length > 0) {
    const { data } = await supabase
      .from("cards")
      .select("id,front_norm")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .in("front_norm", [...new Set(norms)]);
    for (const row of (data ?? []) as { id: string; front_norm: string }[]) {
      if (!existing.has(row.front_norm)) existing.set(row.front_norm, row.id);
    }
  }

  for (const row of rows) {
    const front = row.front.trim();
    const back = row.back.trim();

    if (!front || !back) {
      result.errors.push({ line: row.line, reason: "front or back is empty" });
      continue;
    }

    const duplicateId = existing.get(normalizeFront(front));
    if (duplicateId && strategy === "skip") {
      result.skipped += 1;
      continue;
    }

    try {
      const topicId = await resolveTopicPath(supabase, user.id, row.topic, topicCache);

      /*
        Адрес проверяется здесь же, а не только базой: строка из чужого
        файла попадёт в href, и «javascript:…» оттуда выглядел бы обычной
        ссылкой «Source». База отвергла бы такую строку целиком и уронила
        бы всю карточку — а терять карточку из-за негодной ссылки незачем.
      */
      const url = safeUrl(row.sourceUrl) ?? null;

      const payload = {
        topic_id: topicId,
        front_md: front,
        back_md: back,
        note_md: row.note.trim() || null,
        example_md: row.example.trim() || null,
        link_url: url,
        source_label: row.source.trim() || null,
      };

      if (duplicateId && strategy === "update") {
        const { error } = await supabase
          .from("cards")
          .update(payload)
          .eq("id", duplicateId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
        result.created += 1;
        continue;
      }

      const { data: created, error } = await supabase
        .from("cards")
        .insert({ ...payload, user_id: user.id, import_batch_id: batchId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      void created;
      result.created += 1;
    } catch (e) {
      result.errors.push({
        line: row.line,
        reason: e instanceof Error ? e.message : "unknown error",
      });
    }
  }

  return result;
}

export async function finishImport(
  batchId: string,
  totals: { created: number; skipped: number; errors: number },
): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase
    .from("import_batches")
    .update({
      created_count: totals.created,
      skipped_count: totals.skipped,
      error_count: totals.errors,
      status: "done",
    })
    .eq("id", batchId)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
}

/** Откат импорта: карточки удаляются насовсем, а не в корзину (FR-38). */
export async function undoImport(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("import_batches")
    .select("id,created_at")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!batch) return { ok: false, error: "Import not found" };

  const age = Date.now() - new Date(batch.created_at as string).getTime();
  if (age > 24 * 3600 * 1000) {
    return { ok: false, error: "An import can only be undone within 24 hours" };
  }

  const { error } = await supabase
    .from("cards")
    .delete()
    .eq("user_id", user.id)
    .eq("import_batch_id", batchId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("import_batches")
    .update({ status: "reverted" })
    .eq("id", batchId)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Создание категории прямо из мастера импорта.
 *
 * Именно `createCategory` с родом `area`, а не `resolveTopicPath`: тот для
 * односегментного пути ставит `deck`, потому что считает последний сегмент
 * набором. Для импорта это было бы ровно наоборот тому, что просили — выбрать
 * КАТЕГОРИЮ, в которую лягут наборы из файла.
 */
export async function createImportCategory(
  name: string,
): Promise<{ id?: string; error?: string }> {
  const clean = name.trim();
  if (!clean) return { error: "Enter a name for the category" };
  // «/» — разделитель пути в импорте; внутри имени он разорвал бы адрес темы
  if (clean.includes("/")) return { error: "A category name cannot contain “/”" };

  const res = await createCategory({ name: clean, kind: "area" });
  return res.ok ? { id: res.id } : { error: res.error };
}
