import { describe, expect, it } from "vitest";
import { normalizeFront, normalizeTag, parseTags } from "@/lib/cards";

/**
 * Нормализация тегов держит справочник в порядке: без неё «На Собеседование»
 * и «на-собеседование» разъезжаются в две разные сущности.
 */
describe("normalizeTag", () => {
  it("приводит к нижнему регистру и меняет пробелы на дефисы", () => {
    expect(normalizeTag("На Собеседование")).toBe("на-собеседование");
    expect(normalizeTag("  Interview Prep  ")).toBe("interview-prep");
  });

  it("срезает ведущую решётку", () => {
    expect(normalizeTag("#sql")).toBe("sql");
  });

  it("выбрасывает пунктуацию, но сохраняет буквы любых алфавитов", () => {
    expect(normalizeTag("c++!")).toBe("c");
    expect(normalizeTag("Ökonomie")).toBe("ökonomie");
    expect(normalizeTag("日本語")).toBe("日本語");
  });

  it("на мусоре возвращает пустую строку", () => {
    expect(normalizeTag("!!!")).toBe("");
    expect(normalizeTag("   ")).toBe("");
  });
});

describe("parseTags", () => {
  it("делит по запятым и пробелам и убирает повторы", () => {
    expect(parseTags("sql, Planner sql")).toEqual(["sql", "planner"]);
  });

  it("на пустой строке возвращает пустой список", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("  , , ")).toEqual([]);
  });
});

/**
 * normalizeFront должен повторять поведение генерируемой колонки
 * cards.front_norm: lower(regexp_replace(front_md, '[^[:alnum:]]+', '', 'g')).
 * Разойдутся — импорт перестанет видеть дубли.
 */
describe("normalizeFront", () => {
  it("игнорирует регистр, пробелы и пунктуацию", () => {
    expect(normalizeFront("What is Python?")).toBe(normalizeFront("what   is python"));
  });

  it("различает разные по смыслу строки", () => {
    expect(normalizeFront("cat")).not.toBe(normalizeFront("cats"));
  });

  it("не теряет кириллицу", () => {
    expect(normalizeFront("Что такое РСУБД?")).toBe("чтотакоерсубд");
  });
});
