import { describe, expect, it } from "vitest";
import { originHref, parseOrigin, withOrigin } from "@/lib/back";

const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

/*
  Откуда пришли. Значение приходит из адресной строки и уходит в href —
  то есть это недоверенный ввод, и проверяется он как недоверенный ввод.
*/

describe("parseOrigin", () => {
  it("узнаёт свои экраны", () => {
    expect(parseOrigin("/knowledge")).toEqual({ kind: "knowledge" });
    expect(parseOrigin(`/knowledge/${UUID}`)).toEqual({ kind: "category", id: UUID });
    expect(parseOrigin(`/decks/${UUID}`)).toEqual({ kind: "set", id: UUID });
    expect(parseOrigin("/decks")).toEqual({ kind: "decks" });
    expect(parseOrigin("/library")).toEqual({ kind: "library" });
  });

  it("отбрасывает хвост параметров и якоря", () => {
    expect(parseOrigin("/knowledge?view=list")).toEqual({ kind: "knowledge" });
    expect(parseOrigin("/decks#top")).toEqual({ kind: "decks" });
  });

  it("не пускает чужой адрес", () => {
    // Иначе «назад» уводила бы из приложения, выглядя кнопкой приложения
    expect(parseOrigin("https://evil.example/steal")).toBeNull();
    expect(parseOrigin("//evil.example")).toBeNull();
    expect(parseOrigin("javascript:alert(1)")).toBeNull();
  });

  it("не пускает незнакомый собственный путь", () => {
    // Белый список, а не «всё, что начинается со слэша»: иначе «назад»
    // однажды поведёт на экран, которого уже нет
    expect(parseOrigin("/settings")).toBeNull();
    expect(parseOrigin("/decks/not-a-uuid")).toBeNull();
    expect(parseOrigin("/knowledge/../admin")).toBeNull();
  });

  it("пустое значение — это отсутствие происхождения, а не ошибка", () => {
    expect(parseOrigin(null)).toBeNull();
    expect(parseOrigin(undefined)).toBeNull();
    expect(parseOrigin("")).toBeNull();
  });
});

describe("originHref", () => {
  it("возвращает тот же путь, из которого разобран", () => {
    for (const path of ["/knowledge", `/knowledge/${UUID}`, `/decks/${UUID}`, "/decks", "/library"]) {
      const origin = parseOrigin(path);
      expect(origin).not.toBeNull();
      expect(originHref(origin!)).toBe(path);
    }
  });
});

describe("withOrigin", () => {
  it("добавляет параметр к чистому адресу", () => {
    expect(withOrigin("/decks/x", "/knowledge")).toBe("/decks/x?from=%2Fknowledge");
  });

  it("не затирает уже имеющиеся параметры", () => {
    expect(withOrigin("/library?topic=a", "/knowledge")).toBe(
      "/library?topic=a&from=%2Fknowledge",
    );
  });

  it("кодирует путь целиком — иначе слэши разорвут параметр", () => {
    expect(withOrigin("/x", `/knowledge/${UUID}`)).toContain(encodeURIComponent(`/knowledge/${UUID}`));
  });
});
