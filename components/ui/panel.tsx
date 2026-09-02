/**
 * Поверхности. Три роли вместо разнобоя из rounded и rounded-lg:
 * panel — секция или карточка на фоне страницы,
 * inset — вложенный блок внутри панели,
 * плюс уровень тени, соответствующий роли.
 */
export const panelClass = "rounded-xl border border-line bg-surface shadow-card";
export const raisedClass = "rounded-xl border border-line bg-surface shadow-raised";
export const insetClass = "rounded-lg bg-surface-2";

export function Panel({
  raised = false,
  className = "",
  children,
}: {
  raised?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${raised ? raisedClass : panelClass} ${className}`}>{children}</div>;
}

export type BadgeTone = "neutral" | "accent" | "warn" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  warn: "bg-amber-soft text-amber",
  danger: "bg-rust-soft text-rust",
};

/** Пилюля состояния: категория, счётчик, статус карточки. */
export function Badge({
  tone = "neutral",
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
