import { notFound } from "next/navigation";
import Link from "next/link";
import { getKnowledgeTree } from "@/lib/knowledge";
import { getDeckSummaries } from "@/lib/data";
import { LinkButton } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { DeckCard } from "@/components/deck-card";
import { NewSetButton } from "../new-set-button";

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [tree, summaries] = await Promise.all([
    getKnowledgeTree({ includeArchived: true }),
    getDeckSummaries(),
  ]);
  const node = tree.flat.find((n) => n.id === id);
  if (!node) notFound();

  /*
    Внутри категории лежат НАБОРЫ, и рисовать их надо плиткой набора, а не
    плиткой категории. Прежде здесь стояла вторая CategoryCard: набор
    показывался папкой, у которой внутри ноль папок, — то есть содержимое
    выдавалось за контейнер.
  */
  const sets = summaries.filter((deck) => deck.ancestors.includes(id));

  const tint = node.color || "var(--accent)";
  const trail = node.path.split(" / ").slice(0, -1);

  return (
    <>
      <Link href="/knowledge" className="text-sm text-faint hover:text-ink">
        ← Knowledge
      </Link>

      <header className={`${panelClass} mt-3 p-5 sm:p-6`}>
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-xl text-3xl"
            style={{ background: `color-mix(in srgb, ${tint} 14%, var(--surface))` }}
          >
            {node.icon || node.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            {trail.length > 0 && <p className="label-micro truncate">{trail.join(" / ")}</p>}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{node.name}</h1>
            {node.description && <p className="mt-2 max-w-prose text-muted">{node.description}</p>}
          </div>
        </div>

        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
          <span className="label-micro">
            <span className="tabular-nums">{node.cards}</span>{" "}
            {node.cards === 1 ? "card" : "cards"} in this branch
          </span>
          <span className="label-micro">
            <span className="tabular-nums">{sets.length}</span>{" "}
            {sets.length === 1 ? "set" : "sets"}
          </span>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {/* Учебные экраны остаются прежними: Knowledge — слой над ними,
              а не замена. Отсюда можно уйти учиться, ничего не переучивая. */}
          <LinkButton href={`/review?free=1&topic=${node.id}`} tone="soft">
            Practice this branch
          </LinkButton>
          <LinkButton href={`/decks/${node.id}`}>Edit cards</LinkButton>
          <LinkButton href={`/library?topic=${node.id}`}>Browse in library</LinkButton>
        </div>
      </header>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            {sets.length > 0 ? `Sets · ${sets.length}` : "No sets yet"}
          </h2>
          {/* Создание набора стоит там, где на наборы смотрят. Прежде оно
              жило только в меню на экране категорий: чтобы завести набор в
              этой категории, надо было с неё уйти. */}
          <NewSetButton categoryId={node.id} categoryPath={node.path} />
        </div>

        {sets.length > 0 ? (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sets.map((deck) => (
              <li key={deck.id}>
                <DeckCard deck={deck} />
              </li>
            ))}
          </ul>
        ) : (
          /* Пустая категория — начало, а не поломка. Говорим, чем наполнить,
             и куда за этим идти: создание набора живёт в меню категории. */
          /* Пустая категория — начало, а не поломка. Действие рядом, в
             заголовке раздела, поэтому здесь только объяснение. */
          <div className="mt-3 rounded-xl border border-dashed border-line px-5 py-12 text-center">
            <p className="text-sm text-muted">
              A category holds flashcard sets. Create one above — it can sit empty
              until you have cards for it.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
