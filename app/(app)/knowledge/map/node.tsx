"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNode } from "@/lib/knowledge-graph";

/**
 * Узел карты.
 *
 * Обычный React-компонент на токенах приложения, а не рисунок на канве: у карты
 * не должно быть своего визуального языка. Ровно поэтому из библиотек графов
 * выбрана та, где узел — это разметка, а не спрайт.
 *
 * Роль читается по глубине, а не по отдельному полю: корень — область,
 * второй уровень — раздел, дальше — концепт. Заводить для этого колонку
 * значило бы хранить то, что и так следует из положения в дереве.
 */
export type MapNodeData = GraphNode & {
  selected?: boolean;
  onAttach?: (id: string) => void;
};

function role(depth: number): "Category" | "Topic" | "Concept" {
  if (depth === 0) return "Category";
  if (depth === 1) return "Topic";
  return "Concept";
}

export function MapNode({ data, selected }: NodeProps) {
  const node = data as unknown as MapNodeData;
  const tint = node.color || "var(--accent)";
  const kind = role(node.depth);

  // Концепт считает свои карточки, область — всё, что под ней
  const count = kind === "Concept" ? node.cards : node.cards;
  const unit = count === 1 ? "card" : "cards";

  return (
    <div
      className={`flex w-52 items-center gap-2.5 rounded-xl border-control bg-surface px-3 py-2.5 text-left shadow-card transition-colors ${
        selected ? "border-accent shadow-raised" : "border-line"
      } ${node.archived ? "opacity-55" : ""}`}
    >
      {/* Точки соединения скрыты: рёбра рисует раскладка, а тянуть связь
          мышью здесь пока нечем — это следующая веха */}
      <Handle type="target" position={Position.Top} className="!opacity-0" isConnectable={false} />

      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg text-sm"
        style={{ background: `color-mix(in srgb, ${tint} 18%, var(--surface))` }}
      >
        {node.icon || node.name.trim().charAt(0).toUpperCase()}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">{node.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="label-micro tabular-nums">
            {count} {unit}
          </span>
          {node.children > 0 && (
            <span className="label-micro tabular-nums">· {node.children} sub</span>
          )}
          {node.attached > 0 && (
            <span
              className="label-micro tabular-nums text-accent"
              title="Cards attached here in addition to their main place"
            >
              · +{node.attached}
            </span>
          )}
        </span>
      </span>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0"
        isConnectable={false}
      />
    </div>
  );
}
