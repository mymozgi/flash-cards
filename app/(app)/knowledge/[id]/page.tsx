import { notFound } from "next/navigation";
import Link from "next/link";
import { getKnowledgeTree } from "@/lib/knowledge";
import { LinkButton } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { CategoryCard } from "../category-card";

export default async function CategoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const tree = await getKnowledgeTree({ includeArchived: true });
  const node = tree.flat.find((n) => n.id === id);
  if (!node) notFound();

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
            <span className="tabular-nums">{node.descendants}</span>{" "}
            {node.descendants === 1 ? "subcategory" : "subcategories"}
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
        <h2 className="text-lg font-semibold tracking-tight">
          {node.children.length > 0
            ? `Subcategories · ${node.children.length}`
            : "No subcategories yet"}
        </h2>

        {node.children.length > 0 ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {node.children.map((child) => (
              <li key={child.id}>
                {/* Без меню: правка живёт на экране категорий, где рядом
                    дерево и подтверждения. Кнопка-заглушка была бы хуже
                    её отсутствия. */}
                <CategoryCard node={child} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-line bg-surface py-12 text-center text-sm text-muted">
            Nesting arrives with the structure editor. For now this category holds cards directly.
          </p>
        )}
      </section>
    </>
  );
}
