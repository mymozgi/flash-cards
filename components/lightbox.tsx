"use client";

import { Button } from "@/components/ui/button";

/**
 * Изображение во весь экран.
 *
 * Живёт в просмотре набора: там переворота нет, и клик по картинке свободен.
 * В повторении лупы больше нет намеренно — там нажатие по любой части полотна
 * переворачивает карточку, и перехватывать этот клик значило бы отбирать
 * главное действие экрана ради второстепенного.
 *
 * Принимает не MediaItem, а минимальную пару «адрес и подпись»: вызывающему не
 * нужно тащить размеры и сторону карточки ради показа одной картинки.
 */
export function Lightbox({
  image,
  onClose,
}: {
  image: { url: string; caption?: string | null };
  onClose: () => void;
}) {
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
