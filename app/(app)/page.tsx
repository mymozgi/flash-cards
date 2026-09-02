import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { getDeckSummaries, getSettings, getTodayCounts } from "@/lib/data";
import { DeckCard } from "@/components/deck-card";
import { plural } from "@/lib/day";

export default async function TodayPage() {
  const settings = await getSettings();
  const [counts, decks] = await Promise.all([getTodayCounts(settings), getDeckSummaries()]);
  const done = counts.reviewsDoneToday + counts.newDoneToday;

  return (
    <>
      <header className="border-b border-line-strong pb-5">
        <p className="label-micro">Today</p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight tabular-nums">
          {counts.total}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {counts.total === 0
            ? "Nothing due. Come back tomorrow, or run a free practice round."
            : `${plural(counts.total, "card is", "cards are")} waiting for review`}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {counts.total > 0 && (
          <LinkButton href="/review" tone="primary" size="lg">
            Start
          </LinkButton>
        )}
        <LinkButton href="/review?free=1">Free practice</LinkButton>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
        {[
          { label: "Due", value: counts.due },
          { label: "New", value: counts.newAvailable },
          { label: "Done today", value: done },
          { label: "New limit", value: settings.daily_new_limit },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-3">
            <dt className="label-micro">
              {stat.label}
            </dt>
            <dd className="mt-1 text-xl font-medium tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Your sets</h2>
          <Link href="/decks" className="text-sm text-muted hover:text-ink">
            All sets
          </Link>
        </div>

        {decks.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface py-12 text-center text-sm text-muted">
            No sets yet.{" "}
            <Link href="/decks?new=1" className="text-accent underline underline-offset-4">
              Create the first one
            </Link>
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckCard deck={deck} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
