"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { parseTags, resolveTags, resolveTopicPath } from "@/lib/cards";

export type BulkOp = {
  cardIds: string[];
  action: "suspend" | "unsuspend" | "delete" | "add_tags" | "move_topic";
  tags?: string;
  /**
   * Куда переносим. `null` — вынуть из всех категорий.
   *
   * Идентификатор, а не путь: путь адресовал категорию текстом, и опечатка
   * молча заводила двойника вместо того, чтобы вернуть ошибку. Разбор пути
   * остался там, где текст неизбежен, — в импорте CSV.
   */
  topicId?: string | null;
};

/** Массовые операции над выборкой (FR-28). */
export async function bulkUpdate(op: BulkOp): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  if (op.cardIds.length === 0) return { ok: true };

  try {
    switch (op.action) {
      case "suspend":
      case "unsuspend": {
        const { error } = await supabase
          .from("cards")
          .update({ suspended: op.action === "suspend" })
          .eq("user_id", user.id)
          .in("id", op.cardIds);
        if (error) throw new Error(error.message);
        break;
      }
      case "delete": {
        const { error } = await supabase
          .from("cards")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .in("id", op.cardIds);
        if (error) throw new Error(error.message);
        break;
      }
      case "add_tags": {
        const tagIds = await resolveTags(supabase, user.id, parseTags(op.tags ?? ""));
        if (tagIds.length === 0) break;
        const rows = op.cardIds.flatMap((cardId) =>
          tagIds.map((tagId) => ({ card_id: cardId, tag_id: tagId, user_id: user.id })),
        );
        const { error } = await supabase
          .from("card_tags")
          .upsert(rows, { onConflict: "card_id,tag_id", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        break;
      }
      case "move_topic": {
        const topicId = op.topicId ?? null;
        // Чужую категорию подсунуть нельзя: проверяем принадлежность до записи
        if (topicId) {
          const { data: owned } = await supabase
            .from("topics")
            .select("id")
            .eq("id", topicId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!owned) throw new Error("That category does not exist");
        }
        const { error } = await supabase
          .from("cards")
          .update({ topic_id: topicId })
          .eq("user_id", user.id)
          .in("id", op.cardIds);
        if (error) throw new Error(error.message);
        break;
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The operation failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Создание категории прямо из выбора.
 *
 * Путь здесь уместен: человек набирает новое имя и может сразу вложить его
 * через «/». Разница с прежним поведением в том, что это названное действие
 * с кнопкой «Create», а не молчаливый побочный эффект опечатки в поле выбора.
 */
export async function createCategoryFromPath(
  path: string,
): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  try {
    const id = await resolveTopicPath(supabase, user.id, path);
    if (!id) return { error: "Enter a name for the category" };
    revalidatePath("/", "layout");
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the category" };
  }
}
