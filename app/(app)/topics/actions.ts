"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";

export type TopicState = { error: string | null };

export async function createTopic(_prev: TopicState, formData: FormData): Promise<TopicState> {
  const user = await requireUser();
  const supabase = await createClient();

  const parts = String(formData.get("path") ?? "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length === 0) return { error: "Enter a topic path" };

  let parentId: string | null = null;
  for (const name of parts) {
    const query = supabase.from("topics").select("id").eq("user_id", user.id).eq("name", name);
    const { data: found } = await (
      parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId)
    ).maybeSingle();

    if (found) {
      parentId = found.id as string;
      continue;
    }
    const { data, error } = await supabase
      .from("topics")
      .insert({ user_id: user.id, parent_id: parentId, name })
      .select("id")
      .single();
    if (error) return { error: error.message };
    parentId = data.id as string;
  }

  revalidatePath("/", "layout");
  return { error: null };
}

export async function renameTopic(topicId: string, name: string): Promise<TopicState> {
  const user = await requireUser();
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name cannot be empty" };

  const { error } = await supabase
    .from("topics")
    .update({ name: trimmed })
    .eq("id", topicId)
    .eq("user_id", user.id);

  if (error) {
    return {
      error: error.code === "23505" ? "A sibling topic already has this name" : error.message,
    };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Удаление узла с выбором судьбы карточек (FR-22).
 * reparent — карточки и подтемы поднимаются к родителю;
 * cascade — карточки уходят в корзину вместе с поддеревом.
 */
export async function deleteTopic(
  topicId: string,
  strategy: "reparent" | "cascade",
): Promise<TopicState> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: node } = await supabase
    .from("topics")
    .select("id,parent_id")
    .eq("id", topicId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!node) return { error: "Topic not found" };

  if (strategy === "reparent") {
    const { error: liftTopics } = await supabase
      .from("topics")
      .update({ parent_id: node.parent_id })
      .eq("parent_id", topicId)
      .eq("user_id", user.id);
    if (liftTopics) {
      return {
        error:
          liftTopics.code === "23505"
            ? "The parent already has a subtopic with this name — rename it first"
            : liftTopics.message,
      };
    }
    await supabase
      .from("cards")
      .update({ topic_id: node.parent_id })
      .eq("topic_id", topicId)
      .eq("user_id", user.id);
  } else {
    const { data: all } = await supabase
      .from("topics")
      .select("id,parent_id")
      .eq("user_id", user.id);

    const ids = new Set<string>([topicId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of (all ?? []) as { id: string; parent_id: string | null }[]) {
        if (t.parent_id && ids.has(t.parent_id) && !ids.has(t.id)) {
          ids.add(t.id);
          grew = true;
        }
      }
    }

    await supabase
      .from("cards")
      .update({ deleted_at: new Date().toISOString() })
      .in("topic_id", [...ids])
      .eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("topics")
    .delete()
    .eq("id", topicId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
