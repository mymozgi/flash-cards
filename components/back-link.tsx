import Link from "next/link";

/**
 * Ссылка «назад» с именем того места, куда она ведёт.
 *
 * Подпись — не украшение: «← XR» отвечает на вопрос, куда попадёшь, а
 * «← Back» на него не отвечает и заставляет проверять нажатием. Поэтому
 * подпись обязательна и приходит готовой.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex max-w-full items-center gap-1.5 text-sm text-faint transition-colors hover:text-ink"
    >
      <span aria-hidden>←</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
