/**
 * Границы «дня» считаются в часовом поясе из настроек, а не по часам сервера:
 * иначе дневные лимиты новых карточек сбрасываются в случайный для пользователя момент.
 */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

export function startOfDay(timeZone: string, now: Date = new Date()): Date {
  let offset: number;
  try {
    offset = tzOffsetMs(now, timeZone);
  } catch {
    offset = 0; // некорректная зона в настройках не должна ронять экран
  }
  const shifted = new Date(now.getTime() + offset);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offset);
}

export function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other;
}
