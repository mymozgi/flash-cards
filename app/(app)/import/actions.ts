"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  normalizeFront,
  parseTags,
  resolveTags,
  resolveTopicPath,
  syncCardTags,
} from "@/lib/cards";

export type ImportRow = {
  /** номер строки в исходном файле — попадает в отчёт об ошибках */
  line: number;
  front: string;
  back: string;
  topic: string;
  tags: string;
  note: string;
  reversed: boolean;
  choices: string[];
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
  const tagCache = new Map<string, string>();

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
      const tagIds = await resolveTags(supabase, user.id, parseTags(row.tags), tagCache);
      const distractors = row.choices.map((c) => c.trim()).filter(Boolean).slice(0, 3);

      const payload = {
        topic_id: topicId,
        front_md: front,
        back_md: back,
        note_md: row.note.trim() || null,
        distractors,
      };

      if (duplicateId && strategy === "update") {
        const { error } = await supabase
          .from("cards")
          .update(payload)
          .eq("id", duplicateId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
        await syncCardTags(supabase, user.id, duplicateId, tagIds);
        result.created += 1;
        continue;
      }

      const { data: created, error } = await supabase
        .from("cards")
        .insert({ ...payload, user_id: user.id, import_batch_id: batchId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      const cardId = created.id as string;
      await syncCardTags(supabase, user.id, cardId, tagIds);
      result.created += 1;

      if (row.reversed) {
        const { data: reverse } = await supabase
          .from("cards")
          .insert({
            user_id: user.id,
            topic_id: topicId,
            front_md: back,
            back_md: front,
            note_md: row.note.trim() || null,
            kind: "reversed_of",
            source_card_id: cardId,
            import_batch_id: batchId,
          })
          .select("id")
          .single();
        if (reverse) {
          await syncCardTags(supabase, user.id, reverse.id as string, tagIds);
          result.created += 1;
        }
      }
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
