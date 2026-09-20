/**
 * Поля ввода и их обвязка.
 *
 * Раньше строка классов поля копировалась по файлам и успела разойтись:
 * где-то серая заливка с рамкой по фокусу, где-то постоянная рамка.
 * Здесь один вид и одно место, где его менять.
 */

import { Hint } from "./hint";
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
  "w-full min-h-[var(--control-md)] rounded-lg border-control border-field-line bg-surface px-3.5 py-3 " +
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

/**
 * Подпись поля.
 *
 * Отвечает на один вопрос — «что это за поле». Обязательность помечается
 * звёздочкой, а не словом «(required)»; необязательность не помечается вовсе,
 * потому что помечать нечего: поле без звёздочки и есть необязательное.
 *
 * Звёздочка сама по себе для скринридера — просто символ, поэтому рядом
 * лежит скрытое слово. Цветом одним обходиться нельзя по той же причине.
 *
 * Пояснение уходит в `hint` и всплывает по наведению или фокусу. В подписи
 * ему не место: его читают один раз, а занимает оно место всегда.
 */
export function Label({
  children,
  required = false,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 pb-2 text-sm font-semibold text-ink">
      {children}
      {required && (
        <>
          <span aria-hidden className="text-rust">
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      )}
      {hint && <Hint>{hint}</Hint>}
    </span>
  );
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
