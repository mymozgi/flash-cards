"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { TAG_SLOTS } from "@/lib/tag-color";

export type TagResult = { ok: boolean; error?: string };

/**
 * Цвет тега — номер ячейки палитры, а не произвольный оттенок.
 * Диапазон проверяется и здесь, и ограничением в базе: клиенту верить нельзя,
 * а значение вне палитры отрисовалось бы никак.
 */
export async function setTagColor(tagId: string, slot: number | null): Promise<TagResult> {
  const user = await requireUser();

  if (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= TAG_SLOTS)) {
    return { ok: false, error: "That colour is not in the palette" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ color: slot })
    .eq("id", tagId)
    .eq("user_id", user.id);

  if (error) {
    const missing = error.code === "42703" || error.message.includes("schema cache");
    return {
      ok: false,
      error: missing
        ? "Tag colours need supabase/migrations/0014_tag_color.sql"
        : error.message,
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
