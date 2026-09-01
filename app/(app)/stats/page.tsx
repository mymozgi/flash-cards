import Link from "next/link";
import { getTagStats } from "@/lib/tag-stats";
import { TagShare } from "@/components/tag-share";
import { Panel } from "@/components/ui/panel";

export default async function StatsPage() {
  const stats = await getTagStats();

  return (
    <>
      <header className="border-b border-line pb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Knowledge areas</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Which subjects your cards actually cover, by tag. A card can carry several tags, so the
          shares are of tag assignments rather than of cards.
        </p>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Cards", value: stats.totalCards },
          { label: "Tagged", value: stats.taggedCards },
          { label: "Untagged", value: stats.untaggedCards },
          { label: "Tags in use", value: stats.tagCount },
        ].map((tile) => (
          <Panel key={tile.label} className="px-4 py-3">
            <dt className="text-2xs uppercase tracking-wide text-faint">{tile.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</dd>
          </Panel>
        ))}
      </dl>

      <Panel className="mt-4 p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">Share by tag</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          The six largest areas keep their own colour; everything else is grouped, because a
          seventh generated hue would be indistinguishable from one of the first six.
        </p>
        <TagShare slices={stats.slices} />
      </Panel>

      <Panel className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="px-4 pt-4 text-left text-lg font-semibold tracking-tight">
              Every tag
            </caption>
            <thead>
              <tr className="text-left text-2xs uppercase tracking-wide text-faint">
                <th className="px-4 py-2.5 font-medium">Tag</th>
                <th className="px-4 py-2.5 font-medium">Cards</th>
                <th className="px-4 py-2.5 font-medium">Memorized</th>
                <th className="px-4 py-2.5 font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {stats.all.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    No tags yet.
                  </td>
                </tr>
              ) : (
                stats.all.map((row) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          style={{ background: row.slot < 0 ? "var(--line-strong)" : undefined }}
                          className={`size-2.5 shrink-0 rounded-sm ${row.slot >= 0 ? `tag-hue-${row.slot}` : ""}`}
                        />
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{row.total}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{row.memorized}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">
                      {Math.round(row.share * 100)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {stats.untaggedCards > 0 && (
        <p className="mt-4 text-sm text-muted">
          {stats.untaggedCards} {stats.untaggedCards === 1 ? "card carries" : "cards carry"} no tag
          and stay out of this picture.{" "}
          <Link href="/library" className="text-accent underline underline-offset-4">
            Tag them in the library
          </Link>
        </p>
      )}
    </>
  );
}
