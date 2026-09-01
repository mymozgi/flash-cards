import "server-only";
import { createClient } from "./supabase/server";

/**
 * Доли тегов для экрана статистики.
 *
 * Слотов у категориальной палитры шесть: столько цветов проходят проверку
 * на различимость при дальтонизме в обеих темах. Остальные теги
 * складываются в «Другое» — седьмой сгенерированный цвет был бы
 * неотличим от одного из первых шести.
 */
export const TAG_SLOTS = 6;

export type TagSlice = {
  name: string;
  total: number;
  memorized: number;
  share: number;
  /** Индекс цвета в палитре; -1 у собирательного «Другое». */
  slot: number;
};

export type TagStats = {
  slices: TagSlice[];
  all: TagSlice[];
  taggedCards: number;
  untaggedCards: number;
  totalCards: number;
  tagCount: number;
};

export async function getTagStats(): Promise<TagStats> {
  const supabase = await createClient();

  const [{ data: rows }, { count: totalCards }, { data: links }] = await Promise.all([
    supabase.from("tag_stats").select("tag_id,name,total,memorized").order("total", { ascending: false }),
    supabase.from("cards").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("card_tags").select("card_id"),
  ]);

  const stats = (rows ?? []) as { name: string; total: number; memorized: number }[];
  // одна карточка может нести несколько тегов, поэтому сумма по тегам
  // больше числа карточек — для доли берём именно её
  const taggedCards = new Set((links ?? []).map((l: { card_id: string }) => l.card_id)).size;
  const sum = stats.reduce((acc, row) => acc + row.total, 0);

  const all: TagSlice[] = stats.map((row, index) => ({
    name: row.name,
    total: row.total,
    memorized: row.memorized,
    share: sum === 0 ? 0 : row.total / sum,
    slot: index < TAG_SLOTS ? index : -1,
  }));

  const head = all.slice(0, TAG_SLOTS);
  const tail = all.slice(TAG_SLOTS);
  const slices =
    tail.length === 0
      ? head
      : [
          ...head,
          {
            name: `Other (${tail.length} tags)`,
            total: tail.reduce((acc, row) => acc + row.total, 0),
            memorized: tail.reduce((acc, row) => acc + row.memorized, 0),
            share: tail.reduce((acc, row) => acc + row.share, 0),
            slot: -1,
          },
        ];

  return {
    slices,
    all,
    taggedCards,
    untaggedCards: Math.max(0, (totalCards ?? 0) - taggedCards),
    totalCards: totalCards ?? 0,
    tagCount: stats.length,
  };
}
