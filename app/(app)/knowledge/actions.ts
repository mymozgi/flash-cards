"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";

export type NodeResult = { ok: boolean; error?: string };

/** Правка, которую можно применить к узлу дерева. Все поля необязательные. */
export type NodePatch = {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
  archived?: boolean;
};

/**
 * Отказы базы переводятся в человеческий текст здесь, а не в компоненте:
 * сообщение «duplicate key value violates unique constraint» ничего не говорит
 * о том, что делать дальше.
 */
function explain(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "A category with this name already exists here";
  if (/inside itself/i.test(error.message)) return "A category cannot be placed inside itself";
  if (/six levels/i.test(error.message)) return "The tree is limited to six levels";
  if (error.code === "42703" || error.message.includes("schema cache")) {
    return "Knowledge needs supabase/migrations/0015_knowledge_nodes.sql";
  }
  return error.message;
}

export async function createCategory(input: {
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
}): Promise<NodeResult & { id?: string }> {
  const user = await requireUser();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "The category needs a name" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .insert({
      user_id: user.id,
      parent_id: input.parentId ?? null,
      name,
      icon: input.icon || null,
      color: input.color || null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: explain(error) };
  revalidatePath("/", "layout");
  return { ok: true, id: data.id as string };
}

/**
 * Заготовки при пустом разделе.
 *
 * Создаются только те, что пользователь отметил, и создаются обычными
 * категориями — без пометки «системная» и без защиты от удаления. Заготовка,
 * которую нельзя переименовать или снести, перестаёт быть заготовкой и
 * становится чужой структурой в моём пространстве.
 */
export async function createStarterCategories(
  picks: { name: string; icon: string; color: string }[],
): Promise<NodeResult> {
  const user = await requireUser();
  if (picks.length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("topics").insert(
    picks.map((pick, index) => ({
      user_id: user.id,
      parent_id: null,
      name: pick.name,
      icon: pick.icon,
      color: pick.color,
      position: index,
    })),
  );

  if (error) return { ok: false, error: explain(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateCategory(id: string, patch: NodePatch): Promise<NodeResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const payload: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return { ok: false, error: "The category needs a name" };
    payload.name = name;
  }
  if (patch.description !== undefined) payload.description = patch.description.trim() || null;
  if (patch.color !== undefined) payload.color = patch.color || null;
  if (patch.icon !== undefined) payload.icon = patch.icon || null;
  if (patch.parentId !== undefined) payload.parent_id = patch.parentId;
  if (patch.archived !== undefined) {
    payload.archived_at = patch.archived ? new Date().toISOString() : null;
  }
  if (Object.keys(payload).length === 0) return { ok: true };

  const { error } = await supabase
    .from("topics")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: explain(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}
