"use client";

import { useRef, useState } from "react";
import {
  MAX_IMAGES_PER_SIDE,
  MAX_SOURCE_BYTES,
  formatBytes,
  imagesFromClipboard,
  ratioLabel,
} from "@/lib/image";
import { CloseIcon, ImageIcon, PlusIcon } from "@/components/icons";
import type { EditorImage } from "@/lib/types";

/**
 * Изображения одной стороны карточки.
 *
 * Подписи к изображению здесь нет. Она занимала целое поле ввода в каждой
 * строке и почти никогда не заполнялась: на карточке изображение и есть
 * содержание, называть его отдельно нечем.
 *
 * Осталось то, чем изображением управляют: превью, размеры, пропорция, вес,
 * замена и удаление. Имени файла среди них нет и быть не может — при загрузке
 * файл пережимается в WebP и получает случайное имя, исходное никуда не
 * записывается.
 */
export function ImageStrip({
  images,
  busy,
  onAdd,
  onRemove,
  onReplace,
  onMove,
}: {
  images: EditorImage[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  /** Замена на месте: позиция и порядок сохраняются. */
  onReplace: (index: number, file: File) => void;
  onMove: (index: number, delta: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const swap = useRef<HTMLInputElement>(null);
  /** Какую строку меняем. Один скрытый input на весь список, а не на строку. */
  const replacing = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const full = images.length >= MAX_IMAGES_PER_SIDE;

  const pick = (list: FileList | null) => {
    if (!list) return;
    onAdd([...list]);
    if (input.current) input.current.value = "";
  };

  /*
    Вставка из буфера. Обещание «or paste from the clipboard» висело в
    подсказке с самого начала, а обработчика не было вовсе: функция разбора
    буфера лежала в lib/image.ts и её никто не вызывал.

    Слушаем на своей области, а не на документе. Полос на странице столько
    же, сколько сторон у карточек, и общий слушатель не смог бы решить, в
    какую из них класть: выбирает фокус, и только он.

    Отменяем событие, лишь когда картинка правда нашлась, — иначе обычная
    вставка текста в соседнее поле перестала бы работать.
  */
  const paste = (event: React.ClipboardEvent) => {
    if (busy || full) return;
    const files = imagesFromClipboard(event.clipboardData?.items ?? null);
    if (files.length === 0) return;
    event.preventDefault();
    onAdd(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!full) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!full) pick(e.dataTransfer.files);
      }}
      onPaste={paste}
      className={`rounded-lg border border-dashed transition-colors ${
        images.length > 0 ? "p-2" : "p-0"
      } ${dragging ? "border-accent bg-accent-soft" : "border-line-strong"}`}
    >
      {images.length > 0 && (
        <ul className="mb-2 flex flex-col gap-2">
          {images.map((image, index) => {
            const ratio = ratioLabel(image.width, image.height);
            return (
              <li key={image.storagePath} className="flex items-center gap-3">
                {/* обычный img, а не next/image: файл уже сжат на клиенте,
                    а оптимизация картинок на Vercel Hobby лимитирована */}
                <img
                  src={image.thumbUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded border border-line object-cover"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="font-mono text-2xs text-faint">
                    {image.width}×{image.height} px
                    {ratio && ` · ${ratio}`}
                    {/* Ноль означает «размер неизвестен», а не пустой файл:
                        у старых записей его могло не быть. Показывать «0 KB»
                        значило бы утверждать то, чего мы не знаем. */}
                    {image.bytes > 0 && ` · ${formatBytes(image.bytes)}`}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        replacing.current = index;
                        swap.current?.click();
                      }}
                      className="text-accent hover:underline disabled:opacity-40"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="inline-flex items-center gap-1 text-faint hover:text-rust"
                    >
                      <CloseIcon className="size-3" />
                      Remove
                    </button>
                  </span>
                </div>

                {/* Порядок нужен, только когда изображений правда несколько */}
                {images.length > 1 && (
                  <div className="flex shrink-0 flex-col gap-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => onMove(index, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                      className="px-1.5 text-faint hover:text-ink disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label="Move down"
                      className="px-1.5 text-faint hover:text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      <input
        ref={swap}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          const at = replacing.current;
          replacing.current = null;
          e.target.value = "";
          if (file && at !== null) onReplace(at, file);
        }}
      />

      {images.length === 0 ? (
        /* Пустая зона — сама себе кнопка: попасть в область проще, чем
           в строчку текста, а перетаскивание становится очевидным */
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex min-h-32 w-full flex-col items-center justify-center gap-1.5 px-4 py-6 text-center disabled:opacity-60"
        >
          <ImageIcon className="size-7 text-faint" />
          <span className="text-sm font-medium text-accent">
            {busy ? "Uploading…" : "Add image"}
          </span>
          <span className="text-2xs text-faint">
            or drop a file here, or paste a screenshot with Ctrl/⌘+V
          </span>
          {/* Ограничения названы до загрузки, а не в отказе после неё */}
          <span className="mt-1 font-mono text-2xs text-faint">
            up to {formatBytes(MAX_SOURCE_BYTES)} · JPG, PNG, WebP, GIF
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-0.5 text-xs text-faint">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy || full}
            className="inline-flex items-center gap-1.5 text-accent disabled:opacity-40"
          >
            <PlusIcon className="size-3.5" />
            {busy ? "Uploading…" : "Add image"}
          </button>
          <span>
            {full
              ? `Limit: ${MAX_IMAGES_PER_SIDE} per side`
              : "or drop a file, or paste with Ctrl/⌘+V"}
          </span>
        </div>
      )}
    </div>
  );
}
