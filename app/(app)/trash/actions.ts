"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function restoreCard(cardId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({ deleted_at: null })
    .eq("id", cardId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Удаление насовсем: файлы карточки триггер отправит в очередь на уборку. */
export async function purgeCard(cardId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("cards").delete().eq("id", cardId).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
