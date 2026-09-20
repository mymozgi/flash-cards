/**
 * Откуда пришли.
 *
 * Кнопка «назад» на каждом экране раньше вела в одно и то же место: набор
 * всегда возвращал в «All decks», даже если его открыли из категории.
 * Человек попадал не туда, откуда пришёл, и терял место в дереве.
 *
 * Происхождение передаётся параметром адреса, а не хранится в состоянии и не
 * читается из истории браузера. Причины две. Состояние не переживает
 * перезагрузку и открытие в новой вкладке, а `history.back()` не знает, КУДА
 * ведёт: подпись у него быть не может, и после перезагрузки он уводит вообще
 * из приложения.
 *
 * Подпись здесь не передаётся. Её берут из живых данных по идентификатору:
 * иначе переименованная категория показывалась бы старым именем ровно до
 * следующего перехода.
 */

export type Origin =
  | { kind: "knowledge" }
  | { kind: "category"; id: string }
  | { kind: "set"; id: string }
  | { kind: "decks" }
  | { kind: "library" };

/** Разрешённые адреса происхождения и как из них достаётся сущность. */
const ROUTES: { test: RegExp; make: (m: RegExpMatchArray) => Origin }[] = [
  { test: /^\/knowledge\/([0-9a-f-]{36})$/i, make: (m) => ({ kind: "category", id: m[1] }) },
  { test: /^\/knowledge$/, make: () => ({ kind: "knowledge" }) },
  { test: /^\/decks\/([0-9a-f-]{36})$/i, make: (m) => ({ kind: "set", id: m[1] }) },
  { test: /^\/decks$/, make: () => ({ kind: "decks" }) },
  { test: /^\/library$/, make: () => ({ kind: "library" }) },
];

/**
 * Разбор параметра `from`.
 *
 * Принимается только собственный путь приложения из белого списка. Не потому,
 * что так аккуратнее, а потому, что значение приходит из адресной строки и
 * уходит в `href`: без списка сюда можно было бы подставить чужой адрес и
 * получить переход наружу, замаскированный под кнопку «назад».
 */
export function parseOrigin(from: string | null | undefined): Origin | null {
  if (!from) return null;
  // «//evil.com» и «https://…» — не наши пути, хотя первый и начинается со слэша
  if (!from.startsWith("/") || from.startsWith("//")) return null;

  const path = from.split(/[?#]/)[0];
  for (const route of ROUTES) {
    const hit = path.match(route.test);
    if (hit) return route.make(hit);
  }
  return null;
}

/** Адрес, на который ведёт «назад». */
export function originHref(origin: Origin): string {
  switch (origin.kind) {
    case "knowledge":
      return "/knowledge";
    case "category":
      return `/knowledge/${origin.id}`;
    case "set":
      return `/decks/${origin.id}`;
    case "decks":
      return "/decks";
    case "library":
      return "/library";
  }
}

/**
 * Подпись по умолчанию — когда имя сущности неизвестно.
 *
 * Для категории и набора это временная заглушка: их имена приходят из дерева.
 * Показывать «Category» вместо «XR» можно, только если узел исчез.
 */
export function originFallbackLabel(origin: Origin): string {
  switch (origin.kind) {
    case "knowledge":
      return "Knowledge";
    case "category":
      return "Category";
    case "set":
      return "Set";
    case "decks":
      return "All sets";
    case "library":
      return "Library";
  }
}

/** Добавить происхождение к ссылке, сохранив уже имеющиеся параметры. */
export function withOrigin(href: string, from: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}from=${encodeURIComponent(from)}`;
}
