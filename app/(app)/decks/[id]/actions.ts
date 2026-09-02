"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  coerceImages,
  parseTags,
  resolveTags,
  syncCardMedia,
  syncCardTags,
  type IncomingImage,
} from "@/lib/cards";

/**
 * Карточка в том виде, в каком её правит рабочее пространство колоды:
 * пять слотов ответа, один из которых отмечен верным. Верный слот при
 * сохранении становится оборотом карточки, остальные — неправильными
 * вариантами. Так один и тот же материал работает и в обычном режиме,
 * и в режиме выбора ответа.
 */
export type CardShape = "square" | "landscape" | "portrait";
export type CardLayout = "full_image" | "split";
export type ImagePosition = "left" | "right" | "top" | "bottom";

export type DeckCardInput = {
  id: string;
  isNew: boolean;
  term: string;
  options: string[];
  correctIndex: number;
  example: string;
  mcq: boolean;
  tags: string;
  note: string;
  suspended: boolean;
  shape: CardShape;
  layout: CardLayout;
  imagePosition: ImagePosition;
  frontImages: IncomingImage[];
  backImages: IncomingImage[];
};

export type SaveResult = { ok: boolean; error?: string; saved?: number };

export async function saveDeck(
  topicId: string,
  cards: DeckCardInput[],
  order: string[] = [],
): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const tagCache = new Map<string, string>();
  const positionOf = new Map(order.map((id, index) => [id, index]));
  let saved = 0;

  for (const card of cards) {
    const term = card.term.trim();
    const correct = (card.options[card.correctIndex] ?? "").trim();

    if (!term || !correct) {
      return {
        ok: false,
        error: `Card “${term || "(untitled)"}” needs both a term and a correct answer`,
      };
    }

    const distractors = card.options
      .filter((_, index) => index !== card.correctIndex)
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 4);

    const payload = {
      topic_id: topicId,
      front_md: term,
      back_md: correct,
      example_md: card.example.trim() || null,
      note_md: card.note.trim() || null,
      suspended: card.suspended,
      mcq: card.mcq,
      shape: card.shape,
      layout: card.layout,
      image_position: card.imagePosition,
      position: positionOf.get(card.id) ?? 0,
      distractors,
    };

    if (card.isNew) {
      const { error } = await supabase
        .from("cards")
        .insert({ ...payload, id: card.id, user_id: user.id });
      if (error) return { ok: false, error: `Could not create the card: ${error.message}` };
    } else {
      const { error } = await supabase
        .from("cards")
        .update(payload)
        .eq("id", card.id)
        .eq("user_id", user.id);
      if (error) return { ok: false, error: `Could not save the card: ${error.message}` };
    }

    const tagIds = await resolveTags(supabase, user.id, parseTags(card.tags), tagCache);
    await syncCardTags(supabase, user.id, card.id, tagIds);
    await syncCardMedia(supabase, user.id, card.id, "front", coerceImages(card.frontImages, user.id));
    await syncCardMedia(supabase, user.id, card.id, "back", coerceImages(card.backImages, user.id));
    saved += 1;
  }

  revalidatePath("/", "layout");
  return { ok: true, saved };
}

/** Мягкое удаление: карточка уходит в корзину, файлы остаются до уборки. */
export async function removeCard(cardId: string): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("cards")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDeck(
  topicId: string,
  details: { name: string; description: string; color: string; cover: string | null },
): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const name = details.name.trim();
  if (!name) return { ok: false, error: "The deck needs a name" };

  // Прежняя обложка нужна до записи: если её сменили или сняли, старый файл
  // надо отправить в очередь на уборку, иначе он останется в хранилище навсегда
  const { data: before } = await supabase
    .from("topics")
    .select("image_path")
    .eq("id", topicId)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("topics")
    .update({
      name,
      description: details.description.trim() || null,
      color: details.color || null,
      image_path: details.cover,
    })
    .eq("id", topicId)
    .eq("user_id", user.id);

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "A sibling deck already has this name" : error.message,
    };
  }

  const previous = (before as { image_path: string | null } | null)?.image_path ?? null;
  if (previous && previous !== details.cover) {
    await supabase
      .from("media_orphans")
      .upsert([{ storage_path: previous, user_id: user.id }], { onConflict: "storage_path" });
  }
  // Сохранённая обложка сиротой быть перестаёт
  if (details.cover) {
    await supabase.from("media_orphans").delete().eq("storage_path", details.cover);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Переименование тега по всей базе, а не только в этой колоде (FR-25). */
export async function renameTagEverywhere(from: string, to: string): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const [target] = parseTags(to);
  if (!target) return { ok: false, error: "The new tag name is empty" };

  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", target)
    .maybeSingle();

  const { data: source } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", from)
    .maybeSingle();

  if (!source) return { ok: false, error: `Tag “${from}” not found` };

  // Целевой тег уже есть — это слияние: переносим связи и убираем исходный
  if (existing && existing.id !== source.id) {
    const { data: links } = await supabase
      .from("card_tags")
      .select("card_id")
      .eq("tag_id", source.id);

    for (const link of (links ?? []) as { card_id: string }[]) {
      await supabase
        .from("card_tags")
        .upsert(
          { card_id: link.card_id, tag_id: existing.id, user_id: user.id },
          { onConflict: "card_id,tag_id", ignoreDuplicates: true },
        );
    }
    await supabase.from("tags").delete().eq("id", source.id).eq("user_id", user.id);
  } else {
    const { error } = await supabase
      .from("tags")
      .update({ name: target })
      .eq("id", source.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Удаление тега целиком: связи с карточками уходят каскадом. */
export async function deleteTagEverywhere(name: string): Promise<SaveResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("user_id", user.id)
    .eq("name", name);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Перетаскивание меняет порядок и у нетронутых карточек — пишем его отдельно. */
/**
 * Порядок карточек — одним вызовом.
 *
 * Прежде здесь был цикл с UPDATE на каждую карточку: шестьдесят запросов на
 * набор в шестьдесят карточек, и обрыв посередине оставлял половину порядка
 * новой, а половину прежней. Теперь это одна функция в базе и одна транзакция.
 */
export async function saveOrder(topicId: string, order: string[]): Promise<SaveResult> {
  await requireUser();
  if (order.length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_card_order", {
    p_topic_id: topicId,
    p_ids: order,
  });

  if (error) {
    // Отказ должен называть причину: непринятая миграция иначе выглядит как
    // «порядок почему-то не сохраняется»
    const missing = error.code === "PGRST202" || /set_card_order/i.test(error.message);
    return {
      ok: false,
      error: missing
        ? "Card order could not be saved: apply supabase/migrations/0013_card_order.sql"
        : error.message,
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
