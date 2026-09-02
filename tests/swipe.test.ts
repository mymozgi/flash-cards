import { describe, expect, it } from "vitest";
import { EDGE_RESISTANCE, followX, swipeVerdict } from "@/lib/swipe";

const base = { width: 400, elapsed: 300, atFirst: false, atLast: false };

describe("разбор свайпа", () => {
  it("засчитывает длинный медленный жест", () => {
    // 120 px — это 30 % от 400, порог 25 %
    expect(swipeVerdict({ ...base, dx: -120, dy: 0, elapsed: 900 })).toBe("next");
  });

  it("засчитывает короткий быстрый флик", () => {
    // 40 px за 60 мс — 0,67 px/мс при пороге 0,4; по расстоянию не прошёл бы
    expect(swipeVerdict({ ...base, dx: 40, dy: 0, elapsed: 60 })).toBe("prev");
  });

  it("не засчитывает короткий медленный жест", () => {
    expect(swipeVerdict({ ...base, dx: -40, dy: 0, elapsed: 900 })).toBe("return");
  });

  it("порог зависит от ширины: одно и то же смещение решается по-разному", () => {
    const gesture = { dx: -100, dy: 0, elapsed: 900, atFirst: false, atLast: false };
    expect(swipeVerdict({ ...gesture, width: 360 })).toBe("next");
    expect(swipeVerdict({ ...gesture, width: 1000 })).toBe("return");
  });

  it("отдаёт жест прокрутке, когда вертикаль больше горизонтали", () => {
    expect(swipeVerdict({ ...base, dx: -200, dy: -260, elapsed: 300 })).toBe("return");
  });

  it("на последней карточке возвращает вместо листания вперёд", () => {
    expect(swipeVerdict({ ...base, dx: -200, dy: 0, atLast: true })).toBe("return");
  });

  it("на первой карточке возвращает вместо листания назад", () => {
    expect(swipeVerdict({ ...base, dx: 200, dy: 0, atFirst: true })).toBe("return");
  });

  it("на первой карточке листание вперёд по-прежнему работает", () => {
    expect(swipeVerdict({ ...base, dx: -200, dy: 0, atFirst: true })).toBe("next");
  });

  it("дрожание пальца жестом не считается", () => {
    expect(swipeVerdict({ ...base, dx: -4, dy: 1, elapsed: 20 })).toBe("return");
  });
});

describe("следование за пальцем", () => {
  it("в середине списка карточка идёт за пальцем один в один", () => {
    expect(followX(-80, false, false)).toBe(-80);
  });

  it("на краю движение затухает, но не исчезает", () => {
    expect(followX(-80, false, true)).toBeCloseTo(-80 * EDGE_RESISTANCE);
    expect(followX(80, true, false)).toBeCloseTo(80 * EDGE_RESISTANCE);
  });

  it("на краю движение в разрешённую сторону не затухает", () => {
    expect(followX(-80, true, false)).toBe(-80);
  });
});
