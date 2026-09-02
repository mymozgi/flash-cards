import Link from "next/link";
import { hueClass, slotName, type TagSlot } from "@/lib/tag-color";

/**
 * Пилюля тега.
 *
 * Теги рисовались в шести местах шестью разными способами: где-то моноширинный
 * `#name` серым, где-то бледно-синяя ссылка, где-то просто текст. Один
 * компонент, потому что иначе они разойдутся снова — как когда-то разошлись
 * два редактора карточки.
 *
 * Цвет показывается точкой, а не заливкой под текстом. Так оттенок не влияет
 * на контраст надписи, а сами цвета работают ровно в том виде, в каком их
 * проверяли на различимость, — рядом друг с другом. И имя тега остаётся
 * видно всегда: цвет здесь второй признак, а не единственный.
 */
export function TagChip({
  name,
  slot = null,
  href,
  onRemove,
  className = "",
}: {
  name: string;
  /** Ячейка палитры или null — тогда пилюля нейтральная, как раньше. */
  slot?: TagSlot;
  /** Ссылка на отбор по тегу. Без неё — просто метка. */
  href?: string;
  /** Крестик снятия. Появляется только там, где тег можно снять. */
  onRemove?: () => void;
  className?: string;
}) {
  const shell =
    "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 " +
    "text-2xs font-semibold text-muted";

  const hue = hueClass(slot);
  const body = (
    <>
      {hue && (
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${hue}`}
          title={slotName(slot)}
        />
      )}
      <span className="font-mono">#{name}</span>
    </>
  );

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
