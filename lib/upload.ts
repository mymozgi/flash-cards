import { createClient } from "@/lib/supabase/client";
import { COVER_LONG_SIDE, processImage, type ProcessedImage } from "@/lib/image";
import { MEDIA_BUCKET, publicUrl } from "@/lib/storage";

export type UploadedImage = {
  storagePath: string;
  thumbPath: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  bytes: number;
  caption: string;
};

/**
 * Загрузка идёт из браузера прямо в Supabase Storage, минуя наш сервер:
 * так байты не упираются в лимит тела server action.
 *
 * Каждый залитый файл сразу помечается сиротой. Сохранение карточки эту
 * пометку снимает, а если карточку бросили — файл найдёт ежедневная уборка.
 */
export async function uploadImage(
  userId: string,
  cardId: string,
  file: File,
): Promise<UploadedImage> {
  const processed: ProcessedImage = await processImage(file);
  const supabase = createClient();

  const id = crypto.randomUUID();
  const storagePath = `${userId}/${cardId}/${id}.webp`;
  const thumbPath = `${userId}/${cardId}/${id}.thumb.webp`;

  await supabase.from("media_orphans").upsert(
    [
      { storage_path: storagePath, user_id: userId },
      { storage_path: thumbPath, user_id: userId },
    ],
    { onConflict: "storage_path" },
  );

  const options = { contentType: "image/webp", upsert: false };
  const [full, thumb] = await Promise.all([
    supabase.storage.from(MEDIA_BUCKET).upload(storagePath, processed.full, options),
    supabase.storage.from(MEDIA_BUCKET).upload(thumbPath, processed.thumb, options),
  ]);

  const failure = full.error ?? thumb.error;
  if (failure) throw new Error(`Upload failed: ${failure.message}`);

  return {
    storagePath,
    thumbPath,
    url: publicUrl(storagePath),
    thumbUrl: publicUrl(thumbPath),
    width: processed.width,
    height: processed.height,
    bytes: processed.full.size,
    caption: "",
  };
}

/**
 * Обложка набора.
 *
 * Тот же бакет и тот же конвейер, что у карточек. Новой политики хранилища не
 * нужно: она проверяет только первый сегмент пути, а он по-прежнему
 * идентификатор владельца. Превью не заводится — обложку показывают одного
 * размера везде, второй файл был бы мусором.
 */
export async function uploadCover(
  userId: string,
  topicId: string,
  file: File,
): Promise<{ storagePath: string; url: string }> {
  const processed = await processImage(file, COVER_LONG_SIDE);
  const supabase = createClient();

  const storagePath = `${userId}/topics/${topicId}/${crypto.randomUUID()}.webp`;

  // помечаем сиротой сразу: бросят набор не сохранив — файл найдёт уборка
  await supabase
    .from("media_orphans")
    .upsert([{ storage_path: storagePath, user_id: userId }], { onConflict: "storage_path" });

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, processed.full, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return { storagePath, url: publicUrl(storagePath) };
}

/** Удаление ещё не сохранённого изображения: файлы уже помечены сиротами. */
export async function discardUpload(image: UploadedImage): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(MEDIA_BUCKET).remove([image.storagePath, image.thumbPath]);
}
