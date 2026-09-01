import Link from "next/link";

/**
 * Кнопка приложения.
 *
 * До неё в коде жило двенадцать разных сочетаний паддинга у того, что по сути
 * одна и та же кнопка. Здесь три размера и пять ролей — этого хватает на все
 * экраны, а новая вариация теперь требует осознанного решения, а не случайного
 * `px-5 py-2.5`.
 *
 * Состояния заданы один раз: наведение, фокус с видимым кольцом, нажатие,
 * блокировка и загрузка.
 */
export type ButtonTone = "primary" | "soft" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-colors select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:pointer-events-none disabled:opacity-55";

const TONES: Record<ButtonTone, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 active:brightness-95",
  /**
   * Светлый синий: заметно, но без крика. Заливка светлым синим с белым
   * текстом дала бы контраст 3,68 при норме 4,5 — поэтому светлый фон и
   * синий текст: 4,75 в светлой теме и 6,18 в тёмной.
   */
  soft: "bg-accent-soft text-accent hover:brightness-95 active:brightness-90",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2 active:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-line bg-surface text-rust hover:bg-rust-soft",
};

/**
 * Высота не ниже 44 px у среднего и большого размера: это минимальная
 * цель нажатия на телефоне. Малый размер — только для плотных панелей,
 * где рядом нет соседей.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

export function buttonClass(
  tone: ButtonTone = "secondary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return `${BASE} ${TONES[tone]} ${SIZES[size]} ${extra}`.trim();
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  tone = "secondary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(tone, size, className)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  tone?: ButtonTone;
  size?: ButtonSize;
};

/** Ссылка, выглядящая кнопкой. Отдельный компонент, чтобы не рождался `<a>` внутри `<button>`. */
export function LinkButton({
  tone = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link {...rest} className={buttonClass(tone, size, className)}>
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      className="animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="8" cy="8" r="6" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" strokeLinecap="round" />
    </svg>
  );
}
