import { describe, expect, it } from "vitest";
import {
  deckNameFromFile,
  fileHasCategories,
  importDestination,
} from "@/lib/import-format";

/*
  Куда лягут импортируемые карточки. Проверяется здесь, потому что увидеть это
  нужно ДО записи: после импорта «не туда» остаётся только откат.
*/

describe("importDestination", () => {
  it("режим file оставляет путь из файла нетронутым", () => {
    expect(importDestination("Electricity / Basics", "file", "Physics", "X")).toBe(
      "Electricity / Basics",
    );
    expect(importDestination("Basics", "file", "Physics", "X")).toBe("Basics");
    expect(importDestination("", "file", "Physics", "X")).toBe("");
  });

  it("режим single подставляет выбранную категорию к теме из файла", () => {
    expect(importDestination("Basics", "single", "Physics", "X")).toBe("Physics / Basics");
  });

  it("режим single заменяет категорию из файла — в том и смысл выбора", () => {
    expect(importDestination("Electricity / Basics", "single", "Physics", "X")).toBe(
      "Physics / Basics",
    );
  });

  it("имя темы не теряется при замене категории", () => {
    // Иначе весь файл свалился бы в один набор.
    const rows = ["E / Basics", "E / Safety", "E / Components"];
    const out = rows.map((t) => importDestination(t, "single", "Physics", "X"));
    expect(new Set(out).size).toBe(3);
  });

  it("строке без темы достаётся запасной набор: в категории карточка лежать не может", () => {
    expect(importDestination("", "single", "Physics", "Imported")).toBe("Physics / Imported");
    expect(importDestination("   ", "single", "Physics", "Imported")).toBe("Physics / Imported");
  });

  it("без выбранной категории режим single ничего не выдумывает", () => {
    expect(importDestination("Basics", "single", null, "X")).toBe("Basics");
  });

  it("путь глубже двух уровней сводится к одному набору, а не к вложенности", () => {
    // Модель двухуровневая; splitTopicPath уже склеивает хвост.
    expect(importDestination("A / B / C", "single", "Physics", "X")).toBe("Physics / B — C");
  });
});

describe("fileHasCategories", () => {
  it("видит категорию в двухуровневом пути", () => {
    expect(fileHasCategories(["Electricity / Basics", "Basics"])).toBe(true);
  });

  it("плоский файл категорий не содержит", () => {
    expect(fileHasCategories(["Basics", "Safety", ""])).toBe(false);
    expect(fileHasCategories([])).toBe(false);
  });
});

describe("deckNameFromFile", () => {
  it("срезает расширение и разделители", () => {
    expect(deckNameFromFile("starter-cards.csv")).toBe("starter cards");
    expect(deckNameFromFile("my_deck.json")).toBe("my deck");
  });

  it("на пустом имени даёт осмысленный запасной вариант", () => {
    expect(deckNameFromFile("")).toBe("Imported");
    expect(deckNameFromFile(".csv")).toBe("Imported");
  });
});
