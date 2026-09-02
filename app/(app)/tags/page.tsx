import { createClient } from "@/lib/supabase/server";
import { getTagStats } from "@/lib/tag-stats";
import { toSlot } from "@/lib/tag-color";
import { TagShare } from "@/components/tag-share";
import { Panel } from "@/components/ui/panel";
import { TagsManager, type TagRowView } from "./tags-manager";

export const metadata = {
  title: "Tags — Memorizer",
  description: "Every tag, its colour and how much of your library it covers.",
};

/**
 * Один экран вместо двух.
 *
 * «Manage tags» и «Tag statistics» отвечали на соседние вопросы об одном и том
 * же — «какие у меня теги» и «сколько за каждым стоит». Держать их в разных
 * пунктах меню значило заставлять ходить туда-обратно, чтобы решить, какой тег
 * переименовать или удалить. Сводка теперь стоит там же, где кнопки правки.
 */
export default async function TagsPage() {
  const supabase = await createClient();

  const [{ data: tags }, { data: links }, stats] = await Promise.all([
    supabase.from("tags").select("id,name,color").order("name"),
    supabase.from("card_tags").select("tag_id"),
    getTagStats().catch(() => null),
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tags</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Tags cut across categories: a card lives in one category but can carry any number of
          tags. Renaming into a tag that already exists merges the two. Deleting removes the tag
          from every card — the cards themselves stay. Colours come from a fixed palette of six:
          those six are the ones that stay apart from each other for colour-blind readers, and a
          free picker would quietly break that.
        </p>
      </header>

      {stats && (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Cards", value: stats.totalCards },
              { label: "Tagged", value: stats.taggedCards },
              { label: "Untagged", value: stats.untaggedCards },
              { label: "Tags in use", value: stats.tagCount },
            ].map((tile) => (
              <Panel key={tile.label} className="px-4 py-3">
                <dt className="label-micro">{tile.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</dd>
              </Panel>
            ))}
          </dl>

          <Panel className="mt-4 p-4 sm:p-5">
            <h2 className="text-lg font-semibold tracking-tight">Share by tag</h2>
            <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
              A card can carry several tags, so the shares are of tag assignments rather than of
              cards. The six largest areas keep their own colour; everything else is grouped,
              because a seventh generated hue would be indistinguishable from one of the first six.
            </p>
            <TagShare slices={stats.slices} />
          </Panel>
        </>
      )}

      {!stats && (
        <p role="alert" className="mt-5 rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">
          The share chart needs <code>supabase/migrations/0014_tag_color.sql</code>. Managing tags
          below works without it.
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold tracking-tight">Every tag</h2>
      <TagsManager tags={rows} />
    </>
  );
}
