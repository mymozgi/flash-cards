import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Теги нормализуются при вводе, иначе «На Собеседование» и «на-собеседование» разъезжаются. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

/**
 * Та же нормализация, что у генерируемой колонки cards.front_norm:
 * нижний регистр, всё кроме букв и цифр выброшено. Используется для
 * поиска дублей при импорте (§7.3).
 */
export function normalizeFront(raw: string): string {
  return raw.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(/[,\s]+/).map(normalizeTag).filter(Boolean))];
}

/**
 * «Английский / Грамматика / Времена» → id листа, недостающие узлы создаются.
 * cache переиспользуется между строками импорта: без него каждая строка
 * стоила бы отдельного круга запросов.
 */
export async function resolveTopicPath(
  supabase: SupabaseClient,
  userId: string,
  path: string,
  cache?: Map<string, string | null>,
): Promise<string | null> {
  const key = path.trim();
  if (cache?.has(key)) return cache.get(key) ?? null;

  const parts = key
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (parts.length === 0) {
    cache?.set(key, null);
    return null;
  }

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
    if (error) throw new Error(`Could not create topic “${name}”: ${error.message}`);
    parentId = created.id as string;
  }

  cache?.set(key, parentId);
  return parentId;
}

export async function resolveTags(
  supabase: SupabaseClient,
  userId: string,
  names: string[],
  cache?: Map<string, string>,
): Promise<string[]> {
  const wanted = [...new Set(names)];
  if (wanted.length === 0) return [];

  const known = wanted.filter((n) => cache?.has(n));
  const unknown = wanted.filter((n) => !cache?.has(n));
  const ids = known.map((n) => cache!.get(n)!);

  if (unknown.length > 0) {
    const { data, error } = await supabase
      .from("tags")
      .upsert(
        unknown.map((name) => ({ user_id: userId, name })),
        { onConflict: "user_id,name" },
      )
      .select("id,name");
    if (error) throw new Error(`Could not save tags: ${error.message}`);

    for (const row of (data ?? []) as { id: string; name: string }[]) {
      cache?.set(row.name, row.id);
      ids.push(row.id);
    }
  }

  return ids;
}

export async function syncCardTags(
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

export type IncomingImage = {
  storagePath: string;
  thumbPath: string;
  width: number;
  height: number;
  bytes: number;
  caption: string;
};

export function coerceImages(value: unknown, userId: string): IncomingImage[] {
  if (!Array.isArray(value)) return [];
  return value
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
export async function syncCardMedia(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  side: "front" | "back",
  images: IncomingImage[],
) {
  await supabase.from("media").delete().eq("card_id", cardId).eq("side", side);
  if (images.length === 0) return;

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

  await supabase
    .from("media_orphans")
    .delete()
    .in(
      "storage_path",
      images.flatMap((image) => [image.storagePath, image.thumbPath]),
    );
}
