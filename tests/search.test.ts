import { describe, expect, it } from "vitest";
import { likePattern, orIlike } from "@/lib/search";

/*
  Строка поиска приходит от человека и уходит в фильтр запроса. Проверяется
  как недоверенный ввод, а не как текст.
*/

/** Один обратный слэш. Записан так, чтобы его нельзя было потерять при правке. */
const BS = String.fromCharCode(92);

describe("likePattern", () => {
  it("ищет по части, а не по слову целиком", () => {
    expect(likePattern("spat")).toBe("%spat%");
  });

  it("обрезает пробелы по краям", () => {
    expect(likePattern("  anchor  ")).toBe("%anchor%");
  });

  it("пустой запрос — это отсутствие фильтра, а не поиск пустоты", () => {
    expect(likePattern("")).toBeNull();
    expect(likePattern("   ")).toBeNull();
  });

  it("экранирует подстановочные знаки ILIKE", () => {
    // Иначе «50%» находит вообще всё, а «_» — любой символ на этом месте
    expect(likePattern("50%")).toBe(`%50${BS}%%`);
    expect(likePattern("a_b")).toBe(`%a${BS}_b%`);
  });

  it("обратный слэш становится литералом, а не экранирующим знаком", () => {
    expect(likePattern(`c:${BS}path`)).toBe(`%c:${BS}${BS}path%`);
  });
});

describe("orIlike", () => {
  it("собирает условие по нескольким колонкам", () => {
    expect(orIlike(["front_md", "back_md"], "anchor")).toBe(
      'front_md.ilike."%anchor%",back_md.ilike."%anchor%"',
    );
  });

  it("запятая в запросе не разрывает фильтр", () => {
    // «anchoring, кратко» — обычный запрос, а запятая у PostgREST разделяет
    // условия: без кавычек фильтр распался бы надвое
    expect(orIlike(["front_md"], "anchoring, кратко")).toBe(
      'front_md.ilike."%anchoring, кратко%"',
    );
  });

  it("кавычка в запросе экранируется, а не закрывает значение", () => {
    expect(orIlike(["front_md"], 'a"b')).toBe(`front_md.ilike."%a${BS}"b%"`);
  });

  it("обратный слэш экранируется дважды — для ILIKE и для строки", () => {
    // Сначала как подстановочный знак ILIKE, потом как символ строки
    // PostgREST. Один слэш на входе — четыре на выходе.
    expect(orIlike(["front_md"], `a${BS}b`)).toBe(
      `front_md.ilike."%a${BS}${BS}${BS}${BS}b%"`,
    );
  });

  it("скобки внутри кавычек безопасны", () => {
    expect(orIlike(["front_md"], "f(x)")).toBe('front_md.ilike."%f(x)%"');
  });

  it("без запроса или без колонок условия нет", () => {
    expect(orIlike(["front_md"], "  ")).toBeNull();
    expect(orIlike([], "anchor")).toBeNull();
  });
});
