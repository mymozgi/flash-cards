import { describe, expect, it } from "vitest";
import {
  CANONICAL_COLUMNS,
  ImportFormatError,
  parseJson,
  preview,
  sniffFormat,
} from "@/lib/import-format";

describe("определение формата", () => {
  it("объект и массив читаются как JSON", () => {
    expect(sniffFormat('{"cards":[]}')).toBe("json");
    expect(sniffFormat("[{}]")).toBe("json");
  });

  it("пробелы и перевод строки перед скобкой не мешают", () => {
    expect(sniffFormat("\n\n   [{}]")).toBe("json");
  });

  it("BOM в начале не мешает: его оставляют текстовые редакторы Windows", () => {
    expect(sniffFormat('﻿{"cards":[]}')).toBe("json");
  });

  it("всё остальное читается как CSV", () => {
    expect(sniffFormat("front,back\nдом,house")).toBe("csv");
    expect(sniffFormat("front;back")).toBe("csv");
  });
});

describe("собственная выгрузка", () => {
  const dump = JSON.stringify({
    exported_at: "2026-09-02T10:00:00.000Z",
    topics: [{ id: "t1", path: "Biology / Cells" }],
    cards: [
      {
        id: "c1",
        front_md: "Mitochondrion",
        back_md: "Powerhouse of the cell",
        note_md: "cliché but true",
        kind: "basic",
        topic_path: "Biology / Cells",
        tags: ["biology", "organelles"],
        distractors: ["Ribosome", "Nucleus"],
        scheduling: { state: "review", reps: 12 },
      },
      {
        id: "c2",
        front_md: "House",
        back_md: "Дом",
        note_md: null,
        kind: "reversed_of",
        topic_path: null,
        tags: [],
        distractors: [],
      },
    ],
  });

  it("узнаётся и раскладывается по каноническим колонкам", () => {
    const table = parseJson(dump);
    expect(table.fromExport).toBe(true);
    expect(table.headers).toEqual([...CANONICAL_COLUMNS]);
    expect(table.rows).toHaveLength(2);
  });

  it("круг замыкается: поля выгрузки становятся полями импорта", () => {
    const [first] = parseJson(dump).rows;
    expect(first.front).toBe("Mitochondrion");
    expect(first.back).toBe("Powerhouse of the cell");
    expect(first.topic).toBe("Biology / Cells");
    expect(first.note).toBe("cliché but true");
    expect(first.choice1).toBe("Ribosome");
    expect(first.choice2).toBe("Nucleus");
    expect(first.choice3).toBe("");
  });

  it("список тегов превращается в строку, которую разбирает мастер", () => {
    expect(parseJson(dump).rows[0].tags).toBe("biology, organelles");
  });

  it("обратная карточка помечается тем, что мастер считает истиной", () => {
    const [, second] = parseJson(dump).rows;
    expect(second.reversed).toBe("1");
    expect(parseJson(dump).rows[0].reversed).toBe("0");
  });

  it("пустые поля становятся пустыми строками, а не «null»", () => {
    const [, second] = parseJson(dump).rows;
    expect(second.note).toBe("");
    expect(second.topic).toBe("");
    expect(second.tags).toBe("");
  });
});

describe("произвольный JSON", () => {
  it("массив объектов даёт колонки из ключей", () => {
    const table = parseJson('[{"question":"a","answer":"b"},{"question":"c","answer":"d"}]');
    expect(table.fromExport).toBe(false);
    expect(table.headers).toEqual(["question", "answer"]);
    expect(table.rows[1]).toEqual({ question: "c", answer: "d" });
  });

  it("колонки собираются по всем строкам, а не по первой", () => {
    const table = parseJson('[{"a":"1"},{"b":"2"}]');
    expect(table.headers).toEqual(["a", "b"]);
  });

  it("числа и логические значения приводятся к строкам", () => {
    const table = parseJson('[{"n":42,"yes":true,"no":false}]');
    expect(table.rows[0]).toEqual({ n: "42", yes: "1", no: "0" });
  });

  it("объект с cards, но не нашей формы, читается как обычный массив", () => {
    const table = parseJson('{"cards":[{"q":"a","a":"b"}]}');
    expect(table.fromExport).toBe(false);
    expect(table.headers).toEqual(["q", "a"]);
  });
});

describe("отказы", () => {
  it("сломанный JSON называет причину", () => {
    expect(() => parseJson("{не json")).toThrow(ImportFormatError);
  });

  it("пустой массив — это отказ, а не молчаливый импорт нуля карточек", () => {
    expect(() => parseJson("[]")).toThrow(ImportFormatError);
  });

  it("объект без списка карточек — отказ", () => {
    expect(() => parseJson('{"exported_at":"2026-09-02"}')).toThrow(ImportFormatError);
  });

  it("массив из не-объектов — отказ", () => {
    expect(() => parseJson('["a","b"]')).toThrow(ImportFormatError);
  });
});

describe("эхо вставленного", () => {
  it("длинное обрезается", () => {
    expect(preview("x".repeat(200))).toHaveLength(81);
  });

  it("переводы строк схлопываются, чтобы отказ остался одной строкой", () => {
    expect(preview("front,back\nдом,house")).toBe("front,back дом,house");
  });
});
