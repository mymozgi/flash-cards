import { describe, expect, it } from "vitest";
import { normalizeFront } from "@/lib/cards";

describe("нормализация вопроса", () => {
  it("приводит к нижнему регистру и выбрасывает всё, кроме букв и цифр", () => {
    expect(normalizeFront("Beta blockers?")).toBe("betablockers");
    expect(normalizeFront("  Что   такое  ФСРС ?  ")).toBe("чтотакоефсрс");
  });

  it("две записи одного вопроса совпадают: на этом держится поиск дублей", () => {
    expect(normalizeFront("Hello, world!")).toBe(normalizeFront("hello world"));
  });

  it("пустая строка остаётся пустой, а не превращается в совпадение", () => {
    expect(normalizeFront("")).toBe("");
    expect(normalizeFront("!!!")).toBe("");
  });
});
