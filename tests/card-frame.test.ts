import { describe, expect, it } from "vitest";
import { ASPECT, ASPECT_RATIO, cardFrameStyle } from "@/components/card-renderer";

/*
  Рамка карточки. Правило жило в экране повторения, и просмотр набора о нём не
  знал: он передавал потолок высоты, тот ложился в CSS `max-height`, и карточка
  2:3 выходила пейзажем. Теперь правило одно, и оно проверяется здесь.
*/

describe("cardFrameStyle", () => {
  it("без потолка высоты задаёт только пропорцию", () => {
    expect(cardFrameStyle("portrait")).toEqual({ aspectRatio: "2 / 3" });
    expect(cardFrameStyle("landscape")).toEqual({ aspectRatio: "3 / 2" });
  });

  it("ширину считает из высоты, а не обрезает высоту", () => {
    const style = cardFrameStyle("portrait", "58dvh");
    expect(style.aspectRatio).toBe("2 / 3");
    expect(style.width).toBe(`min(100%, calc(58dvh * ${2 / 3}))`);
    // Именно этого здесь быть не должно: max-height при заданной ширине
    // пропорцию не сохраняет, он её обрезает.
    expect(style).not.toHaveProperty("maxHeight");
  });

  it("портрет уже своей высоты, пейзаж шире", () => {
    // Знак множителя — это и есть разница между 2:3 и 3:2.
    expect(ASPECT_RATIO.portrait).toBeLessThan(1);
    expect(ASPECT_RATIO.landscape).toBeGreaterThan(1);
    expect(ASPECT_RATIO.square).toBe(1);
  });

  it("строка пропорции и число не расходятся", () => {
    // Две записи одного отношения — ровно та пара, которая молча разъезжается.
    for (const shape of ["square", "landscape", "portrait"] as const) {
      const [w, h] = ASPECT[shape].split("/").map((n) => Number(n.trim()));
      expect(w / h).toBeCloseTo(ASPECT_RATIO[shape], 10);
    }
  });

  it("на узком экране ширину ограничивает родитель", () => {
    // min(100%, …) — то, что не даёт карточке вылезти за пределы телефона.
    expect(cardFrameStyle("landscape", "58dvh").width).toContain("min(100%,");
  });
});
