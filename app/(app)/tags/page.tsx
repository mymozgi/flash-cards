import { createClient } from "@/lib/supabase/server";
import { toSlot } from "@/lib/tag-color";
import { TagsManager, type TagRowView } from "./tags-manager";

export default async function TagsPage() {
  const supabase = await createClient();

  const [{ data: tags }, { data: links }] = await Promise.all([
    supabase.from("tags").select("id,name,color").order("name"),
    supabase.from("card_tags").select("tag_id"),
  ]);

  const counts = new Map<string, number>();
  for (const link of (links ?? []) as { tag_id: string }[]) {
    counts.set(link.tag_id, (counts.get(link.tag_id) ?? 0) + 1);
  }

  const rows: TagRowView[] = ((tags ?? []) as { id: string; name: string; color: number | null }[])
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      slot: toSlot(tag.color),
      count: counts.get(tag.id) ?? 0,
    }));

  return (
    <>
      <header className="border-b border-line pb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Manage tags</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Renaming into a tag that already exists merges the two. Deleting removes the tag from
          every card — the cards themselves stay. Colours come from a fixed palette of six: those
          six are the ones that stay apart from each other for colour-blind readers, and a free
          picker would quietly break that.
        </p>
      </header>
      <TagsManager tags={rows} />
    </>
  );
}
