import { createClient } from "@/lib/supabase/server";
import { TrashList, type TrashedCard } from "./trash-list";

const KEEP_DAYS = 30;

export default async function TrashPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cards")
    .select("id,front_md,back_md,deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(200);

  const cards: TrashedCard[] = (
    (data ?? []) as { id: string; front_md: string; back_md: string; deleted_at: string }[]
  ).map((row) => ({
    id: row.id,
    front: row.front_md,
    back: row.back_md,
    deletedAt: row.deleted_at,
    // показываем точную дату сноса, а не «осталось N дней»: для этого
    // пришлось бы звать Date.now() в рендере, а он не чистый
    purgeAt: new Date(
      new Date(row.deleted_at).getTime() + KEEP_DAYS * 86400000,
    ).toISOString(),
  }));

  return (
    <>
      <header className="border-b border-line pb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Deleted cards</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Cards stay here for {KEEP_DAYS} days. Restoring keeps the review history — the schedule
          picks up exactly where it left off.
        </p>
      </header>
      <div className="mt-5">
        <TrashList cards={cards} />
      </div>
    </>
  );
}
