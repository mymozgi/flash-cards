import { describe, expect, it } from "vitest";
import { imagesFromClipboard } from "@/lib/image";

/*
  Разбор буфера обмена. Функция существовала с самого начала и не вызывалась
  ниоткуда — то есть не была проверена ничем, пока подсказка обещала вставку.
*/

type Item = { kind: string; type: string; file: File | null };

/** Минимальная подделка DataTransferItemList: итерируемая и с getAsFile. */
const list = (items: Item[]) =>
  items.map((item) => ({
    kind: item.kind,
    type: item.type,
    getAsFile: () => item.file,
  })) as unknown as DataTransferItemList;

const png = (name: string) => new File([new Uint8Array([1, 2])], name, { type: "image/png" });

describe("imagesFromClipboard", () => {
  it("достаёт изображения", () => {
    const shot = png("shot.png");
    const out = imagesFromClipboard(list([{ kind: "file", type: "image/png", file: shot }]));
    expect(out).toEqual([shot]);
  });

  it("не трогает текст — иначе обычная вставка стала бы загрузкой", () => {
    expect(
      imagesFromClipboard(list([{ kind: "string", type: "text/plain", file: null }])),
    ).toEqual([]);
  });

  it("не берёт файл, который не изображение", () => {
    expect(
      imagesFromClipboard(list([{ kind: "file", type: "application/pdf", file: png("a.pdf") }])),
    ).toEqual([]);
  });

  it("берёт только картинки из смешанного буфера", () => {
    // Скриншот почти всегда приходит вместе с текстовым представлением
    const shot = png("shot.png");
    const out = imagesFromClipboard(
      list([
        { kind: "string", type: "text/html", file: null },
        { kind: "file", type: "image/png", file: shot },
      ]),
    );
    expect(out).toEqual([shot]);
  });

  it("пустой буфер не роняет разбор", () => {
    expect(imagesFromClipboard(null)).toEqual([]);
    expect(imagesFromClipboard(list([]))).toEqual([]);
  });

  it("элемент без файла пропускается, а не даёт null в списке", () => {
    // getAsFile возвращает null, если элемент уже недоступен
    expect(
      imagesFromClipboard(list([{ kind: "file", type: "image/png", file: null }])),
    ).toEqual([]);
  });
});
