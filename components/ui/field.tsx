/**
 * Поля ввода и их обвязка.
 *
 * Раньше строка классов поля копировалась по файлам и успела разойтись:
 * где-то серая заливка с рамкой по фокусу, где-то постоянная рамка.
 * Здесь один вид и одно место, где его менять.
 */
export const inputClass =
  "w-full rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-sm text-ink " +
  "placeholder:text-faint transition-colors " +
  "focus:border-line focus:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 " +
  "focus-visible:outline-accent disabled:opacity-55";

/** Ячейка таблицы: без заливки, пока в неё не встали курсором. */
export const cellInputClass =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm " +
  "focus:border-line focus:bg-surface-2";

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="block pb-1.5 text-sm font-medium text-muted">{children}</span>;
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
        <span className="mt-1 block text-2xs text-rust">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-2xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}
