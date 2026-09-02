/**
 * Разбор горизонтального свайпа.
 *
 * Прежний порог был жёсткий — 60 px. Он одинаково плох с обеих сторон: на
 * экране 360 px это шестая часть ширины, на планшете — двадцатая. Здесь
 * порог считается долей ширины карточки, а быстрый короткий флик засчитывается
 * по скорости: намерение в нём выражено не длиной, а резкостью.
 */

/** Доля ширины, после которой жест засчитан. */
export const COMMIT_RATIO = 0.25;

/** Скорость, при которой засчитывается и короткий жест, px/мс. */
export const COMMIT_VELOCITY = 0.4;

/** До этого смещения ось жеста ещё не выбрана. */
export const AXIS_SLOP = 10;

/** Сопротивление на краю: палец идёт, карточка почти нет. */
export const EDGE_RESISTANCE = 0.3;

export type SwipeVerdict = "prev" | "next" | "return";

export type SwipeInput = {
  /** Смещение по горизонтали, px. Влево — отрицательное. */
  dx: number;
  /** Смещение по вертикали, px. */
  dy: number;
  /** Ширина карточки, px. */
  width: number;
  /** Длительность жеста, мс. */
  elapsed: number;
  atFirst: boolean;
  atLast: boolean;
};

/**
 * Считать ли жест листанием — и в какую сторону.
 *
 * Вертикальное намерение всегда выигрывает: страницу прокручивают тем же
 * пальцем и по той же карточке, и перехватывать это движение значит ломать
 * прокрутку.
 */
export function swipeVerdict({
  dx,
  dy,
  width,
  elapsed,
  atFirst,
  atLast,
}: SwipeInput): SwipeVerdict {
  if (Math.abs(dy) > Math.abs(dx)) return "return";

  const distance = Math.abs(dx);
  const velocity = elapsed > 0 ? distance / elapsed : 0;
  const committed = distance >= width * COMMIT_RATIO || velocity >= COMMIT_VELOCITY;
  if (!committed || distance < AXIS_SLOP) return "return";

  const direction: SwipeVerdict = dx < 0 ? "next" : "prev";
  if (direction === "next" && atLast) return "return";
  if (direction === "prev" && atFirst) return "return";
  return direction;
}

/**
 * Насколько карточка сдвинется за пальцем. У края движение затухает, а не
 * запрещается: «дальше некуда» должно ощущаться, а не выглядеть поломкой.
 */
export function followX(dx: number, atFirst: boolean, atLast: boolean): number {
  const blocked = (dx < 0 && atLast) || (dx > 0 && atFirst);
  return blocked ? dx * EDGE_RESISTANCE : dx;
}
