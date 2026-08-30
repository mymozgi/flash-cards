"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  parseImages,
  parseTags,
  resolveTags,
  resolveTopicPath,
  syncCardMedia,
  syncCardTags,
} from "@/lib/cards";

export type CardFormState = { error: string | null };

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
  const distractors = [1, 2, 3]
    .map((i) => String(formData.get(`distractor${i}`) ?? "").trim())
    .filter(Boolean);
  const frontImages = parseImages(String(formData.get("images_front") ?? ""), user.id);
  const backImages = parseImages(String(formData.get("images_back") ?? ""), user.id);
  const another = formData.get("intent") === "save_and_new";

  if (!front || !back) {
    return { error: "Both sides of the card must be filled in" };
  }

  let topicId: string | null;
  let tagIds: string[];
  try {
    [topicId, tagIds] = await Promise.all([
      resolveTopicPath(supabase, user.id, topicPath),
      resolveTags(supabase, user.id, parseTags(tagsRaw)),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the card" };
  }

  const payload = {
    topic_id: topicId,
    front_md: front,
    back_md: back,
    note_md: note || null,
    distractors,
  };

  if (id) {
    const { error } = await supabase
      .from("cards")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: `Could not save: ${error.message}` };
    await syncCardTags(supabase, user.id, id, tagIds);
    await syncCardMedia(supabase, user.id, id, "front", frontImages);
    await syncCardMedia(supabase, user.id, id, "back", backImages);
  } else {
    // id мог быть выбран клиентом заранее: из него уже построены пути
    // загруженных изображений
    const { data: created, error } = await supabase
      .from("cards")
      .insert({ ...payload, user_id: user.id, ...(newId ? { id: newId } : {}) })
      .select("id")
      .single();
    if (error) return { error: `Could not create the card: ${error.message}` };

    const cardId = created.id as string;
    await syncCardTags(supabase, user.id, cardId, tagIds);
    await syncCardMedia(supabase, user.id, cardId, "front", frontImages);
    await syncCardMedia(supabase, user.id, cardId, "back", backImages);

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
        await syncCardMedia(supabase, user.id, reverseId, "front", backImages);
        await syncCardMedia(supabase, user.id, reverseId, "back", frontImages);
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
