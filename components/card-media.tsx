"use client";

import type { MediaItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

/**
 * Изображения стороны карточки. Обычный <img>, а не next/image: файлы уже
 * сжаты клиентом до загрузки, а оптимизация картинок на Vercel Hobby ограничена.
 * width/height проставлены, чтобы место резервировалось до загрузки и текст
 * не прыгал (§11.1).
 */
export function CardMedia({
  images,
  onOpen,
}: {
  images: MediaItem[];
  onOpen: (image: MediaItem) => void;
}) {
  if (images.length === 0) return null;

  return (
    <ul className={`mt-4 grid gap-3 ${images.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {images.map((image) => (
        <li key={image.id}>
          <button
            type="button"
            onClick={() => onOpen(image)}
            className="block w-full overflow-hidden rounded border border-line bg-surface"
            aria-label={image.caption ?? "Open image full screen"}
          >
            <img
              src={image.url}
              alt={image.caption ?? ""}
              width={image.width}
              height={image.height}
              className="h-auto max-h-[45dvh] w-full object-contain"
            />
          </button>
          {image.caption && (
            <p className="mt-1 text-center text-xs text-faint">{image.caption}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Просмотр во весь экран: тап по изображению в сессии (FR-05). */
export function Lightbox({ image, onClose }: { image: MediaItem; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.caption ?? "Image"}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper/95 p-4"
    >
      <img
        src={image.url}
        alt={image.caption ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] max-w-full object-contain"
        style={{ touchAction: "pinch-zoom" }}
      />
      {image.caption && <p className="mt-3 text-center text-sm text-muted">{image.caption}</p>}
      <Button onClick={onClose} className="mt-4">
        Close
      </Button>
    </div>
  );
}
