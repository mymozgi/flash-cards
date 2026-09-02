/**
 * Разбор пользовательских ссылок.
 *
 * Ссылка приходит из поля ввода и уходит в атрибут href. Это ровно то место,
 * где `javascript:alert(1)` превращается в исполнение чужого кода на странице,
 * поэтому схема проверяется явным списком разрешённых, а не запретом плохих:
 * список запретов всегда неполон — есть ещё data:, vbscript: и blob:.
 */
const ALLOWED = new Set(["http:", "https:"]);

/**
 * Приводит введённое к пригодной ссылке или отказывает.
 * Возвращает `null`, а не бросает: пустое поле — это норма, а не ошибка.
 */
export function safeUrl(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;

  // «example.com/page» человек пишет чаще, чем «https://example.com/page»
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;

  try {
    const url = new URL(candidate);
    return ALLOWED.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Короткая подпись для ссылки: домен без www.
 * Показывать полный адрес незачем — под карточкой важно «откуда», а не «куда
 * именно», а длинный адрес с параметрами ломает вёрстку.
 */
export function hostLabel(value: string | null | undefined): string {
  const safe = safeUrl(value);
  if (!safe) return "";
  try {
    return new URL(safe).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
