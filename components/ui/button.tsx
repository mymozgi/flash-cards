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
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BASE =
  "inline-flex items-center justify-center gap-2.5 rounded-lg font-semibold " +
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
  /**
   * Граница берётся та же, что у поля ввода, — и по той же причине. Заливка
   * кнопки отличается от фона страницы на 1,06, то есть держит форму именно
   * рамка, а рамке контрола положено 3:1. Прежний `--line` давал 1,24.
   */
  secondary:
    "border-control border-field-line bg-surface text-ink hover:bg-surface-2 active:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "border-control border-field-line bg-surface text-rust hover:bg-rust-soft",
};

/**
 * Цель нажатия: 48 px у среднего размера и 56 px у большого — с запасом над
 * минимальными 44 px, потому что запас и есть то, что отличает «попал» от
 * «почти попал» на ходу. Малый размер 40 px — только для плотных панелей,
 * где рядом нет соседних кнопок.
 *
 * `icon` — квадрат под одну иконку без подписи: стрелки листания, закрытие,
 * действие в строке. Он не уже 44 px, иначе перестал бы быть целью.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-12 px-5 text-sm",
  lg: "min-h-14 px-7 text-base",
  icon: "size-12 shrink-0 p-0",
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
