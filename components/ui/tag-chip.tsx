import Link from "next/link";

/**
 * Пилюля тега.
 *
 * Теги рисовались в шести местах шестью разными способами: где-то моноширинный
 * `#name` серым, где-то бледно-синяя ссылка, где-то просто текст. Один
 * компонент, потому что иначе они разойдутся снова — как когда-то разошлись
 * два редактора карточки.
 *
 * Цвета у тегов здесь пока нет намеренно: он требует колонки в базе и решения
 * о палитре (F7 в спецификации). Когда решение будет принято, красить придётся
 * это место, а не шесть.
 */
export function TagChip({
  name,
  href,
  onRemove,
  className = "",
}: {
  name: string;
  /** Ссылка на отбор по тегу. Без неё — просто метка. */
  href?: string;
  /** Крестик снятия. Появляется только там, где тег можно снять. */
  onRemove?: () => void;
  className?: string;
}) {
  const shell =
    "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 " +
    "text-2xs font-semibold text-muted";

  const body = <span className="font-mono">#{name}</span>;

  if (onRemove) {
    return (
      <span className={`${shell} pr-1.5 ${className}`}>
        {body}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove the tag ${name}`}
          className="grid size-5 shrink-0 place-items-center rounded-full text-faint hover:bg-surface hover:text-rust"
        >
          <svg viewBox="0 0 16 16" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </span>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`${shell} hover:bg-accent-soft hover:text-accent ${className}`}>
        {body}
      </Link>
    );
  }

  return <span className={`${shell} ${className}`}>{body}</span>;
}
