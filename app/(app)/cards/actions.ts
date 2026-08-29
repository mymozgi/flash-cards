"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, requireUser } from "@/lib/supabase/server";

export type CardFormState = { error: string | null };

// в файле с "use server" экспортироваться могут только async-функции
function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

/** «Английский / Грамматика / Времена» → id листа, недостающие узлы создаются (FR-33). */
async function resolveTopicPath(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<string | null> {
  const parts = path
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  for (const name of parts) {
    const query = supabase.from("topics").select("id").eq("user_id", userId).eq("name", name);
    const { data: found } = await (
      parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId)
    ).maybeSingle();

    if (found) {
      parentId = found.id as string;
      continue;
    }

    const { data: created, error } = await supabase
      .from("topics")
      .insert({ user_id: userId, parent_id: parentId, name })
      .select("id")
      .single();
    if (error) throw new Error(`Не удалось создать тему «${name}»: ${error.message}`);
    parentId = created.id as string;
  }
  return parentId;
}

async function resolveTags(
  supabase: SupabaseClient,
  userId: string,
  raw: string,
): Promise<string[]> {
  const names = [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ];
  if (names.length === 0) return [];

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name" },
    )
    .select("id");
  if (error) throw new Error(`Не удалось сохранить теги: ${error.message}`);
  return (data ?? []).map((t) => t.id as string);
}

async function syncCardTags(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  tagIds: string[],
) {
  await supabase.from("card_tags").delete().eq("card_id", cardId);
  if (tagIds.length === 0) return;
  await supabase
    .from("card_tags")
    .insert(tagIds.map((tagId) => ({ card_id: cardId, tag_id: tagId, user_id: userId })));
}


type IncomingImage = {
  storagePath: string;
  thumbPath: string;
  width: number;
  height: number;
  bytes: number;
  caption: string;
};

/**
 * Пути приходят с клиента, поэтому проверяем, что они лежат в папке владельца:
 * политика хранилища устроена так же, но полагаться на один слой не стоит.
 */
function parseImages(raw: string, userId: string): IncomingImage[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is IncomingImage => {
      if (!item || typeof item !== "object") return false;
      const image = item as Partial<IncomingImage>;
      return (
        typeof image.storagePath === "string" &&
        typeof image.thumbPath === "string" &&
        image.storagePath.startsWith(`${userId}/`) &&
        image.thumbPath.startsWith(`${userId}/`) &&
        Number.isFinite(image.width) &&
        Number.isFinite(image.height)
      );
    })
    .slice(0, 4);
}

/**
 * Полная замена набора изображений стороны. Старые строки удаляются, и триггер
 * помечает их файлы к уборке; уборка пропускает пути, на которые ещё есть
 * ссылки в media, поэтому пересохранение той же карточки ничего не сносит.
 */
async function syncMedia(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  side: "front" | "back",
  images: IncomingImage[],
) {
  await supabase.from("media").delete().eq("card_id", cardId).eq("side", side);

  if (images.length > 0) {
    await supabase.from("media").insert(
      images.map((image, index) => ({
        user_id: userId,
        card_id: cardId,
        side,
        storage_path: image.storagePath,
        thumb_path: image.thumbPath,
        width: Math.round(image.width),
        height: Math.round(image.height),
        bytes: Math.round(image.bytes ?? 0),
        caption: image.caption?.trim() || null,
        position: index,
      })),
    );

    // файлы прикреплены к карточке — снимаем пометку сироты
    await supabase
      .from("media_orphans")
      .delete()
      .in(
        "storage_path",
        images.flatMap((image) => [image.storagePath, image.thumbPath]),
      );
  }
}

export async function saveCard(
  _prev: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const user = await requireUser();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "").trim();
  const newId = String(formData.get("new_id") ?? "").trim();
  const front = String(formData.get("front_md") ?? "").trim();
  const back = String(formData.get("back_md") ?? "").trim();
  const note = String(formData.get("note_md") ?? "").trim();
  const topicPath = String(formData.get("topic_path") ?? "");
  const tagsRaw = String(formData.get("tags") ?? "");
  const reversed = formData.get("reversed") === "on";
  const frontImages = parseImages(String(formData.get("images_front") ?? ""), user.id);
  const backImages = parseImages(String(formData.get("images_back") ?? ""), user.id);
  const another = formData.get("intent") === "save_and_new";

  if (!front || !back) {
    return { error: "Обе стороны карточки должны быть заполнены" };
  }

  let topicId: string | null;
  let tagIds: string[];
  try {
    [topicId, tagIds] = await Promise.all([
      resolveTopicPath(supabase, user.id, topicPath),
      resolveTags(supabase, user.id, tagsRaw),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка сохранения" };
  }

  const payload = {
    topic_id: topicId,
    front_md: front,
    back_md: back,
    note_md: note || null,
  };

  if (id) {
    const { error } = await supabase
      .from("cards")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: `Не удалось сохранить: ${error.message}` };
    await syncCardTags(supabase, user.id, id, tagIds);
    await syncMedia(supabase, user.id, id, "front", frontImages);
    await syncMedia(supabase, user.id, id, "back", backImages);
  } else {
    // id мог быть выбран клиентом заранее: из него уже построены пути
    // загруженных изображений
    const { data: created, error } = await supabase
      .from("cards")
      .insert({ ...payload, user_id: user.id, ...(newId ? { id: newId } : {}) })
      .select("id")
      .single();
    if (error) return { error: `Не удалось создать карточку: ${error.message}` };

    const cardId = created.id as string;
    await syncCardTags(supabase, user.id, cardId, tagIds);
    await syncMedia(supabase, user.id, cardId, "front", frontImages);
    await syncMedia(supabase, user.id, cardId, "back", backImages);

    if (reversed) {
      const { data: back2 } = await supabase
        .from("cards")
        .insert({
          user_id: user.id,
          topic_id: topicId,
          front_md: back,
          back_md: front,
          note_md: note || null,
          kind: "reversed_of",
          source_card_id: cardId,
        })
        .select("id")
        .single();
      if (back2) {
        const reverseId = back2.id as string;
        await syncCardTags(supabase, user.id, reverseId, tagIds);
        // стороны меняются местами вместе с текстом; файлы те же самые
        await syncMedia(supabase, user.id, reverseId, "front", backImages);
        await syncMedia(supabase, user.id, reverseId, "back", frontImages);
      }
    }
  }

  revalidatePath("/", "layout");
  redirect(another ? "/cards/new?saved=1" : "/library");
}

export async function setSuspended(cardId: string, suspended: boolean) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("cards")
    .update({ suspended })
    .eq("id", cardId)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
}

/** Мягкое удаление: карточка остаётся в базе 30 дней (FR-09). */
export async function deleteCard(cardId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/library");
}

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
        const tagIds = await resolveTags(supabase, user.id, op.tags ?? "");
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
    return { ok: false, error: e instanceof Error ? e.message : "Операция не удалась" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
