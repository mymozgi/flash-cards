import Link from "next/link";
import { getSettings, getTodayCounts, getTopicTree } from "@/lib/data";
import { plural } from "@/lib/day";

export default async function TodayPage() {
  const settings = await getSettings();
  const [counts, topics] = await Promise.all([getTodayCounts(settings), getTopicTree()]);
  const done = counts.reviewsDoneToday + counts.newDoneToday;

  return (
    <>
      <header className="border-b border-line-strong pb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Сегодня</p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight tabular-nums">
          {counts.total}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {counts.total === 0
            ? "Очередь пуста. Возвращайтесь завтра или потренируйтесь свободно."
            : `${plural(counts.total, "карточка ждёт", "карточки ждут", "карточек ждут")} повторения`}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {counts.total > 0 && (
          <Link
            href="/review"
            className="rounded bg-accent px-5 py-4 text-center text-base font-medium text-accent-ink"
          >
            Начать
          </Link>
        )}
        <Link
          href="/review?free=1"
          className="rounded border border-line px-5 py-3 text-center text-sm text-muted hover:text-ink"
        >
          Свободная тренировка
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
        {[
          { label: "К повторению", value: counts.due },
          { label: "Новых", value: counts.newAvailable },
          { label: "Сделано сегодня", value: done },
          { label: "Лимит новых", value: settings.daily_new_limit },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-4 py-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.13em] text-faint">
              {stat.label}
            </dt>
            <dd className="mt-1 text-xl font-medium tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Темы</h2>
        {topics.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Тем пока нет.{" "}
            <Link href="/cards/new" className="text-accent underline underline-offset-4">
              Создайте первую карточку
            </Link>{" "}
            — тему можно завести прямо в редакторе.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded border border-line bg-surface">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/library?topic=${topic.id}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm hover:bg-surface-2"
                  style={{ paddingLeft: `${16 + topic.depth * 18}px` }}
                >
                  <span className={topic.depth === 0 ? "font-medium" : "text-muted"}>
                    {topic.name}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-faint">
                    {topic.cardCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
