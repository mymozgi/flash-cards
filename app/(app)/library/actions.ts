"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { parseTags, resolveTags, resolveTopicPath } from "@/lib/cards";

export type BulkOp = {
  cardIds: string[];
  action: "suspend" | "unsuspend" | "delete" | "add_tags" | "move_topic";
  tags?: string;
  topicPath?: string;
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
        const topicId = await resolveTopicPath(supabase, user.id, op.topicPath ?? "");
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
