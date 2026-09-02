import dagre from "@dagrejs/dagre";
import type { GraphEdge, GraphNode } from "@/lib/knowledge-graph";

/**
 * Раскладка карты.
 *
 * Dagre, а не собственный алгоритм: у дерева раскладка считается в один проход
 * и пишется за вечер, но карта деревом не ограничивается — смысловые связи
 * делают её графом с циклами, а там аккуратная укладка слоёв уже нетривиальна.
 * Тридцать килобайт против недели отладки — обмен очевидный.
 *
 * Размеры узлов заданы здесь константами, а не измеряются в DOM: измерение
 * потребовало бы отрисовать карту, замерить и переложить — то есть показать
 * пользователю кучу узлов в одной точке, а потом дёрнуть их по местам.
 */
export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 62;

export type Placed = GraphNode & { x: number; y: number };

export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): Placed[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    // Просветы подобраны под ноды 208×62: меньше — подписи слипаются,
    // больше — ветка перестаёт читаться как одно целое
    nodesep: 28,
    ranksep: 72,
    marginx: 24,
    marginy: 24,
  });

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    // Смысловые связи в раскладке не участвуют: они соединяют узлы поперёк
    // иерархии, и если дать им влиять на слои, дерево перестанет быть деревом
    if (edge.kind === "hierarchy") graph.setEdge(edge.source, edge.target);
  }

  dagre.layout(graph);

  return nodes.map((node) => {
    const placed = graph.node(node.id);
    return {
      ...node,
      // dagre отдаёт центр, React Flow ждёт левый верхний угол
      x: (placed?.x ?? 0) - NODE_WIDTH / 2,
      y: (placed?.y ?? 0) - NODE_HEIGHT / 2,
    };
  });
}
