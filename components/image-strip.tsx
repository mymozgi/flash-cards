"use client";

import { useRef, useState } from "react";
import { MAX_IMAGES_PER_SIDE, formatBytes } from "@/lib/image";
import { CloseIcon } from "@/components/icons";
import type { EditorImage } from "@/lib/types";

export function ImageStrip({
  images,
  busy,
  onAdd,
  onRemove,
  onCaption,
  onMove,
}: {
  images: EditorImage[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  onCaption: (index: number, caption: string) => void;
  onMove: (index: number, delta: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const full = images.length >= MAX_IMAGES_PER_SIDE;

  const pick = (list: FileList | null) => {
    if (!list) return;
    onAdd([...list]);
    if (input.current) input.current.value = "";
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
      className={`rounded border border-dashed p-2 ${
        dragging ? "border-accent bg-accent-soft" : "border-line"
      }`}
    >
      {images.length > 0 && (
        <ul className="mb-2 flex flex-col gap-2">
          {images.map((image, index) => (
            <li key={image.storagePath} className="flex items-start gap-2">
              {/* обычный img, а не next/image: файл уже сжат на клиенте,
                  а оптимизация картинок на Vercel Hobby лимитирована */}
              <img
                src={image.thumbUrl}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded border border-line object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <input
                  value={image.caption}
                  onChange={(e) => onCaption(index, e.target.value)}
                  placeholder="Caption — optional"
                  className="w-full rounded border border-line bg-surface px-2 py-1 text-xs"
                />
                <span className="font-mono text-2xs text-faint">
                  {image.width}×{image.height} · {formatBytes(image.bytes)}
                </span>
              </div>
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
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  aria-label="Remove image"
                  className="px-1.5 text-faint hover:text-rust"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy || full}
          className="text-accent disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Add image"}
        </button>
        <span>
          {full
            ? `Limit: ${MAX_IMAGES_PER_SIDE} per side`
            : "or drop a file, or paste from the clipboard"}
        </span>
      </div>
    </div>
  );
}
