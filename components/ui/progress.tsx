/**
 * Полоса прогресса.
 *
 * До неё полосу рисовали вручную в двух местах и разной толщины: волосок в
 * просмотре набора и полтора пикселя в плитке набора. Здесь одна толщина и
 * одна разметка для озвучки.
 *
 * Второй сегмент, `warn`, нужен потому, что очередь повторения умеет расти:
 * проваленная карточка возвращается в ту же сессию. Если показывать только
 * долю сделанного, полоса поедет назад и это будет выглядеть поломкой.
 * Поэтому знаменатель считает вызывающий по максимуму из виденного, а
 * вернувшиеся карточки видны отдельным янтарным куском — по правилу проекта
 * янтарный значит «не ошибка, но и не норма».
 */
export function Progress({
  value,
  max,
  warn = 0,
  label,
  className = "",
}: {
  /** Сколько сделано. */
  value: number;
  /** Сколько всего. Ноль или меньше — полоса пустая, а не сломанная. */
  max: number;
  /** Часть от `value`, показанная янтарным: вернулось на переучивание. */
  warn?: number;
  /** Текстовая альтернатива: полосу нужно не только видеть, но и услышать. */
  label: string;
  className?: string;
}) {
  const total = Math.max(0, max);
  const done = Math.min(Math.max(0, value), total);
  const flagged = Math.min(Math.max(0, warn), done);
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={label}
      className={`flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div
        className="h-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${pct(done - flagged)}%` }}
      />
      <div
        className="h-full bg-amber transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${pct(flagged)}%` }}
      />
    </div>
  );
}
