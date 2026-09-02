/**
 * Конвейер обработки изображений (§5.2). Работает целиком в браузере — вес файла
 * задаётся ДО загрузки, потому что хранилище ограничено гигабайтом и чистить
 * его постфактум поздно.
 */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const MAX_LONG_SIDE = 1600;
export const THUMB_LONG_SIDE = 320;
/**
 * Обложка набора сжимается жёстче карточной картинки: на плитке шириной
 * 320 px разницы с 1600 не видно, а гигабайт хранилища общий на всё.
 */
export const COVER_LONG_SIDE = 800;
export const WEBP_QUALITY = 0.82;
export const MAX_IMAGES_PER_SIDE = 4;

export type ProcessedImage = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
};

export class ImageError extends Error {}

function fit(width: number, height: number, longSide: number) {
  const scale = Math.min(1, longSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function toWebp(bitmap: ImageBitmap, longSide: number): Promise<Blob> {
  const size = fit(bitmap.width, bitmap.height, longSide);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) throw new ImageError("The browser refused a canvas for image processing");
  context.drawImage(bitmap, 0, 0, size.width, size.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  if (!blob) throw new ImageError("Could not encode the image as WebP");
  return blob;
}

export async function processImage(
  file: File,
  longSide: number = MAX_LONG_SIDE,
): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError(`“${file.name}” is not an image`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageError(
      `“${file.name}” is ${Math.round(file.size / 1024 / 1024)} MB — over the 15 MB limit`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC с айфона декодируется в Safari, но не в Chrome на десктопе
    throw new ImageError(
      `This browser cannot decode “${file.type || "unknown"}”. ` +
        "Re-save the file as JPEG or PNG.",
    );
  }

  try {
    const size = fit(bitmap.width, bitmap.height, longSide);
    const [full, thumb] = await Promise.all([
      toWebp(bitmap, longSide),
      toWebp(bitmap, THUMB_LONG_SIDE),
    ]);
    return { full, thumb, width: size.width, height: size.height };
  } finally {
    bitmap.close();
  }
}

/** Файлы-изображения из события вставки — вставка скриншота из буфера (JTBD-2). */
export function imagesFromClipboard(items: DataTransferItemList | null): File[] {
  if (!items) return [];
  const files: File[] = [];
  for (const item of items) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
