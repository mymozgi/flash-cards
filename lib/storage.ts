export const MEDIA_BUCKET = "cards";

/**
 * Адрес файла в публичном бакете строится по имени, без обращения к API,
 * поэтому одинаково работает и на сервере, и в браузере.
 */
export function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
