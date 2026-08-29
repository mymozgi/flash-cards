import { createClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET } from "@/lib/storage";

/**
 * Ежедневная уборка (§5.2). На тарифе Hobby доступен один запуск в сутки,
 * поэтому эндпоинт делает обе задачи сразу:
 *
 *  1. Удаляет файлы, помеченные сиротами больше суток назад: брошенные
 *     загрузки и картинки удалённых карточек.
 *  2. Дёргает базу лёгким запросом — проект Supabase на бесплатном тарифе
 *     засыпает после недели простоя.
 *
 * Работает от service_role, потому что сессии пользователя тут нет.
 */
export const dynamic = "force-dynamic";

const ORPHAN_AGE_HOURS = 24;
const BATCH = 100;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Не авторизовано" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json(
      { error: "Не задан SUPABASE_SERVICE_ROLE_KEY — уборка отключена" },
      { status: 501 },
    );
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - ORPHAN_AGE_HOURS * 3600 * 1000).toISOString();

  const { data: orphans, error } = await supabase
    .from("media_orphans")
    .select("storage_path")
    .lt("marked_at", cutoff)
    .limit(BATCH);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const candidates = (orphans ?? []).map((row) => row.storage_path as string);
  let deleted: string[] = [];

  if (candidates.length > 0) {
    // Обратная карточка ссылается на те же файлы, что и прямая, поэтому
    // перед удалением проверяем, что на путь больше никто не ссылается.
    const [{ data: byFull }, { data: byThumb }] = await Promise.all([
      supabase.from("media").select("storage_path").in("storage_path", candidates),
      supabase.from("media").select("thumb_path").in("thumb_path", candidates),
    ]);

    const stillUsed = new Set<string>([
      ...(byFull ?? []).map((r) => r.storage_path as string),
      ...(byThumb ?? []).map((r) => r.thumb_path as string),
    ]);

    deleted = candidates.filter((path) => !stillUsed.has(path));

    if (deleted.length > 0) {
      const { error: removeError } = await supabase.storage.from(MEDIA_BUCKET).remove(deleted);
      if (removeError) {
        return Response.json({ error: removeError.message }, { status: 500 });
      }
    }

    // Снимаем пометку и с удалённых, и с тех, что снова оказались нужны
    await supabase.from("media_orphans").delete().in("storage_path", candidates);
  }

  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .limit(1);

  return Response.json({
    ok: true,
    проверено: candidates.length,
    удалено: deleted.length,
    сохранено: candidates.length - deleted.length,
    карточек: count ?? 0,
  });
}
