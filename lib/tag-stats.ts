import "server-only";
import { createClient } from "./supabase/server";
import { toSlot } from "./tag-color";

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

  // Цвет отдельной попыткой: до миграции 0014 его во вьюхе нет
  const withColor = await supabase
    .from("tag_stats")
    .select("tag_id,name,color,total,memorized")
    .order("total", { ascending: false });
  const rowsResult = withColor.error
    ? await supabase
        .from("tag_stats")
        .select("tag_id,name,total,memorized")
        .order("total", { ascending: false })
    : withColor;

  if (rowsResult.error) {
    // Отказ должен называть причину: непринятая миграция иначе выглядит
    // как «тегов нет», хотя они есть
    throw new Error(
      `Knowledge areas need the tag_stats view — apply supabase/migrations/0014_tag_color.sql (${rowsResult.error.message})`,
    );
  }

  const [{ count: totalCards }, { data: links }] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("card_tags").select("card_id"),
  ]);

  const stats = (rowsResult.data ?? []) as {
    name: string;
    total: number;
    memorized: number;
    color?: number | null;
  }[];
  // одна карточка может нести несколько тегов, поэтому сумма по тегам
  // больше числа карточек — для доли берём именно её
  const taggedCards = new Set((links ?? []).map((l: { card_id: string }) => l.card_id)).size;
  const sum = stats.reduce((acc, row) => acc + row.total, 0);

  /*
    Цвет берётся выбранный, а не по месту в рейтинге. Иначе один и тот же тег
    был бы разного цвета на карточке и здесь.

    Тегам без своего цвета раздаются оставшиеся свободные ячейки, а не первые
    по порядку: иначе тег без цвета мог бы получить оттенок, уже занятый
    соседом, и на полосе они слились бы в один кусок.
  */
  const taken = new Set(
    stats.map((row) => toSlot(row.color)).filter((slot): slot is number => slot !== null),
  );
  const free = Array.from({ length: TAG_SLOTS }, (_, i) => i).filter((i) => !taken.has(i));

  const all: TagSlice[] = stats.map((row) => {
    const chosen = toSlot(row.color);
    return {
      name: row.name,
      total: row.total,
      memorized: row.memorized,
      share: sum === 0 ? 0 : row.total / sum,
      slot: chosen ?? free.shift() ?? -1,
    };
  });

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
