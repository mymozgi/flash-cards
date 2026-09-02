"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";

export type AttachResult = { ok: boolean; error?: string; count?: number };

function explain(error: { code?: string; message: string }): string {
  if (error.code === "42P01" || /schema cache/i.test(error.message)) {
    return "Attaching cards needs supabase/migrations/0019_card_topics.sql";
  }
  return error.message;
}

/** Карточки, которые можно прикрепить: всё, что не лежит здесь уже. */
export async function searchCards(
  topicId: string,
  query: string,
): Promise<{ id: string; front: string; path: string | null }[]> {
  const user = await requireUser();
  const supabase = await createClient();

  let q = supabase
    .from("cards")
    .select("id,front_md,topic_id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .limit(30);

  const text = query.trim();
  if (text) q = q.ilike("front_md", `%${text}%`);

  const { data } = await q;
  return ((data ?? []) as { id: string; front_md: string; topic_id: string | null }[])
    .filter((row) => row.topic_id !== topicId)
    .map((row) => ({ id: row.id, front: row.front_md, path: row.topic_id }));
}

/**
 * Прикрепить пачку карточек к категории.
 *
 * Именно прикрепить, а не перенести: главное место карточки остаётся прежним.
 * Одно знание может относиться и к «Cognitive Biases», и к «Decision Making»,
 * и копия здесь была бы худшим решением — две копии дают две истории
 * повторений одного знания, то есть врут алгоритму.
 */
export async function attachCards(topicId: string, cardIds: string[]): Promise<AttachResult> {
  const user = await requireUser();
  if (cardIds.length === 0) return { ok: true, count: 0 };

  const supabase = await createClient();
  const { error } = await supabase.from("card_topics").upsert(
    cardIds.map((cardId) => ({ card_id: cardId, topic_id: topicId, user_id: user.id })),
    { onConflict: "card_id,topic_id", ignoreDuplicates: true },
  );

  if (error) return { ok: false, error: explain(error) };
  revalidatePath("/", "layout");
  return { ok: true, count: cardIds.length };
}

export async function detachCard(topicId: string, cardId: string): Promise<AttachResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("card_topics")
    .delete()
    .eq("topic_id", topicId)
    .eq("card_id", cardId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: explain(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Что уже прикреплено к узлу. */
export async function attachedCards(
  topicId: string,
): Promise<{ id: string; front: string }[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("card_topics")
    .select("card_id, cards!inner(id,front_md,deleted_at)")
    .eq("topic_id", topicId)
    .eq("user_id", user.id);

  if (error) return [];
  return ((data ?? []) as unknown as { cards: { id: string; front_md: string; deleted_at: string | null } }[])
    .filter((row) => row.cards.deleted_at === null)
    .map((row) => ({ id: row.cards.id, front: row.cards.front_md }));
}
