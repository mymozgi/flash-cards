/**
 * Поля ввода и их обвязка.
 *
 * Раньше строка классов поля копировалась по файлам и успела разойтись:
 * где-то серая заливка с рамкой по фокусу, где-то постоянная рамка.
 * Здесь один вид и одно место, где его менять.
 */
/**
 * Граница видима всегда, а не только в фокусе: заливка #f1f3f5 даёт контраст
 * 1,03 с фоном страницы и 1,11 с белой панелью — поле неотличимо от воздуха.
 * Подложка эту задачу не решает, решает именно граница.
 */
/**
 * Кегль 16 px, а не 14: Safari на iPhone приближает страницу при фокусе на
 * поле мельче шестнадцати, и вернуть масштаб обратно пользователь уже не
 * может. Высота 48 px совпадает с кнопкой среднего размера — стоящие рядом
 * поле и кнопка выстраиваются по одной линии без подгонки на месте.
 */
export const inputClass =
  "w-full min-h-12 rounded-lg border-control border-field-line bg-surface px-3.5 py-3 " +
  "text-base text-ink placeholder:text-faint transition-colors " +
  "hover:border-ink focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-accent disabled:opacity-55";

/** Ячейка таблицы: без заливки, пока в неё не встали курсором. */
/**
 * Выпадающий список. Системная стрелка прижимается к самой рамке и на
 * коротких значениях налезает на текст, поэтому родная убрана, своя
 * нарисована фоном и справа оставлено под неё место.
 */
export const selectClass =
  inputClass +
  " appearance-none bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-11 " +
  "bg-[image:var(--select-arrow)]";

/**
 * В ячейке таблицы границу даёт сама сетка, поэтому поле остаётся плоским —
 * и остаётся мелким: таблица существует ради плотности, и раздувать её строки
 * до высоты обычного поля значит отменить причину, по которой она нужна.
 */
export const cellInputClass =
  "w-full rounded-md border border-transparent bg-transparent px-2.5 py-1.5 text-sm " +
  "hover:border-line focus:border-accent focus:bg-surface";

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="block pb-2 text-sm font-semibold text-ink">{children}</span>;
}

/**
 * Подпись, поле и пояснение под ним. Пояснение — не украшение: оно объясняет
 * последствие, а не повторяет название.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
      {error ? (
        <span className="mt-1.5 block text-2xs font-medium text-rust">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-2xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}
