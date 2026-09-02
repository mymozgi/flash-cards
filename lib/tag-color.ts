/**
 * Палитра тегов.
 *
 * Шесть ячеек, а не свободный выбор цвета. Эти шесть значений живут в
 * `app/globals.css` как классы `tag-hue-0…5` и проверены скриптом валидации на
 * различимость при дальтонизме: худшая соседняя пара даёт ΔE 9,1 в светлой
 * теме и 8,4 в тёмной при пороге 8. Произвольный HEX эту проверку отменяет —
 * два тега смогут разойтись на 2 ΔE и слиться при протанопии.
 *
 * Цвет здесь никогда не единственный признак: имя тега видно всегда, а сам
 * цвет показывается точкой рядом с ним, а не заливкой под текстом. Так
 * оттенок не влияет на контраст надписи и используется ровно так, как его и
 * проверяли, — рядом с другими такими же.
 */

export const TAG_SLOTS = 6;

/** Названия для озвучки: по одному цвету скринридер ничего не скажет. */
export const SLOT_NAMES = ["Blue", "Orange", "Green", "Amber", "Pink", "Forest"] as const;

export type TagSlot = number | null;

/** Класс заливки для ячейки палитры. Вне диапазона — нейтральный. */
export function hueClass(slot: TagSlot): string {
  return slot !== null && slot >= 0 && slot < TAG_SLOTS ? `tag-hue-${slot}` : "";
}

export function slotName(slot: TagSlot): string {
  return slot !== null && slot >= 0 && slot < TAG_SLOTS ? SLOT_NAMES[slot] : "No colour";
}

/**
 * Приводит значение из базы к номеру ячейки или к отсутствию цвета.
 *
 * Пустые значения отсекаются до `Number()` намеренно: `Number(null)` и
 * `Number("")` дают ноль, то есть тег без цвета молча становился бы синим.
 */
export function toSlot(value: unknown): TagSlot {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n < TAG_SLOTS ? n : null;
}
