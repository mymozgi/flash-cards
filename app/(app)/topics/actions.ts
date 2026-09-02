"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { resolveTopicPath } from "@/lib/cards";

export type TopicState = { error: string | null };

/**
 * Создание набора по пути «Категория / Тема».
 *
 * Разбор пути делает resolveTopicPath — тот же, что в импорте и в выборе
 * категории. Прежде здесь лежала вторая копия того же кода, и она успела
 * разойтись с первой: копия создавала узлы без рода, то есть категориями, и
 * после введения формы дерева «Psychology / Habits» отклонялось бы триггером —
 * категория внутри категории.
 *
 * Две реализации одного правила — это две правды, и одна из них всегда
 * устаревает молча.
 */
export async function createTopic(_prev: TopicState, formData: FormData): Promise<TopicState> {
  const user = await requireUser();
  const supabase = await createClient();

  const path = String(formData.get("path") ?? "").trim();
  if (!path) return { error: "Enter a name, or Category / Topic to nest it" };

  try {
    const id = await resolveTopicPath(supabase, user.id, path);
    if (!id) return { error: "Enter a name, or Category / Topic to nest it" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create it";
    return {
      error: /already exists|23505/i.test(message)
        ? "Something with this name already exists here"
        : message,
    };
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
