import { describe, expect, it } from "vitest";
import { plural, startOfDay } from "@/lib/day";

/**
 * Границы дня решают, когда обнуляются дневные лимиты. Ошибка здесь
 * означает, что счётчик новых карточек сбрасывается в чужую полночь.
 */
describe("startOfDay", () => {
  it("возвращает местную полночь, а не UTC", () => {
    const now = new Date("2026-03-15T10:30:00Z");
    const kyiv = startOfDay("Europe/Kyiv", now);
    // Киев в марте — UTC+2, значит местная полночь это 22:00 предыдущих суток UTC
    expect(kyiv.toISOString()).toBe("2026-03-14T22:00:00.000Z");
  });

  it("для UTC совпадает с полуночью UTC", () => {
    const now = new Date("2026-03-15T10:30:00Z");
    expect(startOfDay("UTC", now).toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("учитывает пояса западнее нуля", () => {
    const now = new Date("2026-03-15T10:30:00Z");
    // Нью-Йорк в марте UTC-4: местная полночь это 04:00 UTC того же дня
    expect(startOfDay("America/New_York", now).toISOString()).toBe("2026-03-15T04:00:00.000Z");
  });

  it("не падает на неизвестном поясе, а откатывается к UTC", () => {
    const now = new Date("2026-03-15T10:30:00Z");
    expect(startOfDay("Nowhere/Nothing", now).toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });

  it("возвращает момент не позже текущего", () => {
    const now = new Date("2026-07-01T00:05:00Z");
    expect(startOfDay("Europe/Kyiv", now).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});

describe("plural", () => {
  it("выбирает единственное только для единицы", () => {
    expect(plural(1, "card", "cards")).toBe("card");
    expect(plural(0, "card", "cards")).toBe("cards");
    expect(plural(21, "card", "cards")).toBe("cards");
  });
});
