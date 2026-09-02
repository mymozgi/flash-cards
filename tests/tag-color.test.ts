import { describe, expect, it } from "vitest";
import { hueClass, slotName, TAG_SLOTS, toSlot } from "@/lib/tag-color";

describe("ячейки палитры тегов", () => {
  it("каждая ячейка даёт свой класс", () => {
    const classes = Array.from({ length: TAG_SLOTS }, (_, i) => hueClass(i));
    expect(new Set(classes).size).toBe(TAG_SLOTS);
    expect(classes).toEqual(["tag-hue-0", "tag-hue-1", "tag-hue-2", "tag-hue-3", "tag-hue-4", "tag-hue-5"]);
  });

  it("отсутствие цвета не даёт класса", () => {
    expect(hueClass(null)).toBe("");
  });

  it("значение вне палитры считается отсутствием цвета", () => {
    // за границей палитры класса tag-hue-6 в стилях нет, и цветной блок
    // отрисовался бы прозрачным — молча и неотличимо от ошибки
    expect(hueClass(TAG_SLOTS)).toBe("");
    expect(hueClass(-1)).toBe("");
  });

  it("у каждой ячейки есть имя для озвучки", () => {
    for (let i = 0; i < TAG_SLOTS; i++) {
      expect(slotName(i)).not.toBe("No colour");
      expect(slotName(i).length).toBeGreaterThan(2);
    }
    expect(slotName(null)).toBe("No colour");
  });
});

describe("приведение значения из базы", () => {
  it("пропускает номера внутри палитры", () => {
    expect(toSlot(0)).toBe(0);
    expect(toSlot(TAG_SLOTS - 1)).toBe(TAG_SLOTS - 1);
  });

  it("отбрасывает всё остальное", () => {
    expect(toSlot(null)).toBeNull();
    expect(toSlot(undefined)).toBeNull();
    expect(toSlot(TAG_SLOTS)).toBeNull();
    expect(toSlot(-1)).toBeNull();
    expect(toSlot(1.5)).toBeNull();
    expect(toSlot("не число")).toBeNull();
  });

  it("читает число, пришедшее строкой: PostgREST так отдаёт числовые типы", () => {
    expect(toSlot("3")).toBe(3);
  });
});
