import Link from "next/link";
import { getKnowledgeGraph } from "@/lib/knowledge-graph";
import { KnowledgeMap } from "./knowledge-map";

export const metadata = {
  title: "Category map — Memorizer",
  description: "Your categories, their nesting and the cards attached to them.",
};

export default async function MapPage() {
  const graph = await getKnowledgeGraph();

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="label-micro">Categories</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Map</h1>
        </div>
        <Link href="/knowledge" className="text-sm text-accent underline underline-offset-4">
          Back to categories
        </Link>
      </header>

      <div className="mt-5">
        {graph.nodes.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface py-16 text-center text-sm text-muted">
            Nothing to draw yet.{" "}
            <Link href="/knowledge" className="text-accent underline underline-offset-4">
              Create a category
            </Link>{" "}
            and the map appears.
          </p>
        ) : (
          <KnowledgeMap
            nodes={graph.nodes}
            edges={graph.edges}
            attachReady={graph.attachReady}
          />
        )}
      </div>

      {/* Карта на телефоне остаётся, но честно предупреждает: узлы шириной в
          208 px на 360 px экрана превращают её в разглядывание в замочную
          скважину. Дерево там удобнее, и путь к нему рядом. */}
      <p className="mt-3 text-sm text-muted sm:hidden">
        On a small screen the{" "}
        <Link href="/knowledge" className="text-accent underline underline-offset-4">
          Tree view
        </Link>{" "}
        is easier to work with.
      </p>
    </>
  );
}
