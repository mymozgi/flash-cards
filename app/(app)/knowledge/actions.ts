"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { isMissingColumn } from "@/lib/schema";

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
  if (/category lives at the top level/i.test(error.message)) {
    return "A category lives at the top level. To nest it, make it a topic instead.";
  }
  if (/topic cannot live inside another topic/i.test(error.message)) {
    return "A topic holds cards, not other topics. Drop it on a category instead.";
  }
  if (/flashcard group, not in a category/i.test(error.message)) {
    return "Cards live in a flashcard group. Create one inside this category first.";
  }
  if (/Move the cards out/i.test(error.message)) {
    return "This group still holds cards — move them out before turning it into a category";
  }
  if (error.code === "42703" || error.message.includes("schema cache")) {
    return "Knowledge needs supabase/migrations/0015_knowledge_nodes.sql";
  }
  return error.message;
}

/**
 * Создание узла.
 *
 * Род задаётся намерением, а не угадывается потом по данным. Категория держит
 * структуру и своих карточек не имеет; группа держит карточки и живёт внутри
 * категории. Раньше это было одно действие на два смысла — отсюда и брались
 * «категории» в списке наборов с кнопкой Practice, которой нечего запускать.
 *
 * Если колонки рода ещё нет (миграция 0020 не применена), узел создаётся
 * по-старому: приложение работает, просто различие пока держится на данных.
 */
export async function createCategory(input: {
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  kind?: "area" | "deck";
}): Promise<NodeResult & { id?: string }> {
  const user = await requireUser();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "It needs a name" };

  const supabase = await createClient();
  const base = {
    user_id: user.id,
    parent_id: input.parentId ?? null,
    name,
    icon: input.icon || null,
    color: input.color || null,
  };

  let attempt = await supabase
    .from("topics")
    .insert({ ...base, kind: input.kind ?? "area" })
    .select("id")
    .single();

  if (attempt.error && isMissingColumn(attempt.error)) {
    attempt = await supabase.from("topics").insert(base).select("id").single();
  }

  if (attempt.error) return { ok: false, error: explain(attempt.error) };
  revalidatePath("/", "layout");
  return { ok: true, id: attempt.data.id as string };
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

/**
 * Перемещение узла: новый родитель и новое место среди братьев.
 *
 * Порядок пересчитывается для всей новой ветки, а не только для тронутого
 * узла: position — это позиция среди братьев, и если её не переписать целиком,
 * два узла получат одинаковое число и порядок станет зависеть от того, как
 * база вернула строки.
 *
 * Петля и превышение глубины не проверяются здесь: это делает триггер в базе.
 * Проверка в приложении была бы второй копией правила, которая однажды
 * разойдётся с первой — а обойти её можно любым другим клиентом.
 */
export async function moveCategory(
  id: string,
  parentId: string | null,
  siblingsInOrder: string[],
): Promise<NodeResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("topics")
    .update({ parent_id: parentId })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: explain(error) };

  for (const [index, siblingId] of siblingsInOrder.entries()) {
    const { error: orderError } = await supabase
      .from("topics")
      .update({ position: index })
      .eq("id", siblingId)
      .eq("user_id", user.id);
    if (orderError) return { ok: false, error: explain(orderError) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Порядок среди братьев без смены родителя. */
export async function reorderCategories(siblingsInOrder: string[]): Promise<NodeResult> {
  const user = await requireUser();
  const supabase = await createClient();

  for (const [index, id] of siblingsInOrder.entries()) {
    const { error } = await supabase
      .from("topics")
      .update({ position: index })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: explain(error) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Удаление категории. Содержимое должно куда-то деться, и выбор из двух
 * исходов делает пользователь — молча снести ветку нельзя.
 */
export async function removeCategory(
  id: string,
  strategy: "reparent" | "cascade",
): Promise<NodeResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: node } = await supabase
    .from("topics")
    .select("id,parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!node) return { ok: false, error: "Category not found" };

  if (strategy === "cascade") {
    // Каскад делает сама база: parent_id объявлен on delete cascade,
    // а карточки — on delete set null, то есть они остаются
    const { error } = await supabase.from("topics").delete().eq("id", id).eq("user_id", user.id);
    if (error) return { ok: false, error: explain(error) };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const parentId = (node as { parent_id: string | null }).parent_id;
  const { error: lift } = await supabase
    .from("topics")
    .update({ parent_id: parentId })
    .eq("parent_id", id)
    .eq("user_id", user.id);
  if (lift) return { ok: false, error: explain(lift) };

  await supabase
    .from("cards")
    .update({ topic_id: parentId })
    .eq("topic_id", id)
    .eq("user_id", user.id);

  const { error } = await supabase.from("topics").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: explain(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Удаление набора вместе с его карточками. НЕОБРАТИМО.
 *
 * Решение владельца продукта, подтверждённое дважды. Я возражал: всё
 * остальное приложение даёт на возврат тридцать дней, и удаление карточки
 * из конструктора обратимо, а удаление набора — нет. Возражение снято,
 * поведение записано здесь, чтобы следующий читатель не счёл это недосмотром
 * и не «починил» обратно.
 *
 * Уходит вместе с карточками их история повторений: `reviews` привязаны к
 * карточке каскадом. Именно это и делает действие необратимым — набор
 * пересоздать легко, накопленное расписание нет.
 *
 * Файлы изображений уничтожать не нужно руками: удаление строки `media`
 * поднимает триггер `media_orphan_sweep`, и пути уходят в очередь на
 * ежедневную уборку.
 *
 * `removeCategory` для этого не годится: там `cascade` сносит только узел, а
 * карточки по `on delete set null` остаются без набора и всплывают в
 * библиотеке как ничьи. Для категории это верно — её содержимое переживает
 * её. Для набора это оставляло бы после удаления мусор.
 */
export async function removeSet(id: string): Promise<NodeResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: node } = await supabase
    .from("topics")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!node) return { ok: false, error: "Set not found" };

  // Сначала карточки: если удаление не удастся, набор останется на месте и
  // будет видно, что именно не получилось. Иначе карточки пережили бы свой
  // набор и всплыли бы в библиотеке ничьими.
  const { error: wiped } = await supabase
    .from("cards")
    .delete()
    .eq("topic_id", id)
    .eq("user_id", user.id);
  if (wiped) return { ok: false, error: explain(wiped) };

  const { error } = await supabase.from("topics").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: explain(error) };

  revalidatePath("/", "layout");
  return { ok: true };
}
