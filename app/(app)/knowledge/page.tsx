import { getKnowledgeTree } from "@/lib/knowledge";
import { KnowledgeIndex } from "./knowledge-index";

export const metadata = {
  title: "Knowledge — Memorizer",
  description: "Your own structure: categories, subcategories and where each card lives.",
};

export default async function KnowledgePage() {
  const tree = await getKnowledgeTree();

  return (
    <>
      <header className="border-b border-line pb-5">
        <p className="label-micro">Knowledge</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          My knowledge. My structure.
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          Categories are yours to name, colour, nest and rearrange. Nothing here is fixed — the
          shape of this tree is the shape you give it.
        </p>
      </header>

      <KnowledgeIndex
        roots={tree.roots}
        flat={tree.flat}
        legacy={tree.legacy}
        countsReady={tree.countsReady}
      />
    </>
  );
}
