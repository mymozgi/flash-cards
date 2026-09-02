import "server-only";

/**
 * Мягкая работа с колонками, которых может не быть.
 *
 * Урок, оплаченный поломкой очереди повторения: новая колонка в SELECT — это
 * не «немного больше данных», а условие работы всего запроса. Пока миграция не
 * применена, PostgREST отклоняет запрос целиком, и экран, которому источник
 * был нужен для строчки под карточкой, перестаёт показывать карточки вовсе.
 *
 * Правило простое: **необязательные данные не должны быть обязательными для
 * запроса**. Источник карточки — украшение; очередь повторения — суть.
 *
 * Флаг кэшируется на время жизни процесса и только в сторону «есть»: колонка
 * может появиться (применили миграцию), но не может исчезнуть. Поэтому
 * отрицательный ответ перепроверяется на каждом запросе и сам себя лечит,
 * а положительный больше ничего не стоит.
 */
let sourcePresent: boolean | null = null;

/** `false` — точно нет; `true`/`null` — стоит попробовать. */
export function trySourceColumn(): boolean {
  return sourcePresent !== false;
}

export function rememberSourceColumn(ok: boolean): void {
  sourcePresent = ok;
}

/** Отказ именно из-за отсутствующей колонки, а не из-за прав или сети. */
export function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

/** Список колонок с необязательным Source или без него. */
export function withSource(columns: string, extra = "link_url"): string {
  return trySourceColumn() ? `${columns},${extra}` : columns;
}
