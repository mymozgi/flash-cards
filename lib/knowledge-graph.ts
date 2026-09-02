import "server-only";
import { createClient } from "./supabase/server";
import { getKnowledgeTree, type KnowledgeNode } from "./knowledge";

/**
 * Данные карты знаний.
 *
 * Карта — это то же дерево `topics`, только с двумя добавками: сколько
 * карточек прикреплено к узлу дополнительно и какие узлы связаны между собой
 * не иерархией. Ни одной новой сущности здесь снова нет.
 */

export type GraphNode = {
  id: string;
  parentId: string | null;
  name: string;
  icon: string;
  color: string;
  depth: number;
  /** Карточки во всей ветке. */
  cards: number;
  /** Прямые подкатегории. */
  children: number;
  /** Карточки, прикреплённые сюда дополнительно (не главным местом). */
  attached: number;
  archived: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  /** hierarchy — родитель и ребёнок; relation — смысловая связь. */
  kind: "hierarchy" | "relation";
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Миграция 0019 не применена: прикрепление карточек ещё недоступно. */
  attachReady: boolean;
};

export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const supabase = await createClient();
  const tree = await getKnowledgeTree();

  const attachedRows = await supabase.from("topic_attached").select("topic_id,attached");
  const attachReady = !attachedRows.error;
  const attached = new Map<string, number>(
    ((attachedRows.data ?? []) as { topic_id: string; attached: number }[]).map((row) => [
      row.topic_id,
      row.attached,
    ]),
  );

  const nodes: GraphNode[] = tree.flat.map((node: KnowledgeNode) => ({
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    icon: node.icon,
    color: node.color,
    depth: node.depth,
    cards: node.cards,
    children: node.children.length,
    attached: attached.get(node.id) ?? 0,
    archived: node.archived,
  }));

  const edges: GraphEdge[] = nodes
    .filter((node) => node.parentId)
    .map((node) => ({
      id: `h:${node.parentId}:${node.id}`,
      source: node.parentId as string,
      target: node.id,
      kind: "hierarchy" as const,
    }));

  return { nodes, edges, attachReady };
}
