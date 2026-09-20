"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, GraphNode } from "@/lib/knowledge-graph";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { SearchIcon } from "@/components/icons";
import { layoutGraph, NODE_HEIGHT, NODE_WIDTH } from "./graph-layout";
import { MapNode } from "./node";
import { NodePanel } from "./node-panel";

const NODE_TYPES = { knowledge: MapNode };

export function KnowledgeMap(props: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  attachReady: boolean;
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}

function Canvas({
  nodes: source,
  edges: links,
  attachReady,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  attachReady: boolean;
}) {
  const flow = useReactFlow();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<GraphNode | null>(null);
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});

  const placed = useMemo(() => layoutGraph(source, links), [source, links]);

  const nodes: Node[] = useMemo(
    () =>
      placed.map((node) => ({
        id: node.id,
        type: "knowledge",
        // Ручное положение перекрывает расчётное: раскладка — предложение,
        // а не приговор. «Reset layout» стирает эти сдвиги.
        position: moved[node.id] ?? { x: node.x, y: node.y },
        data: node as unknown as Record<string, unknown>,
        selected: picked?.id === node.id,
      })),
    [placed, moved, picked],
  );

  const edges: Edge[] = useMemo(
    () =>
      links.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        // Иерархия сплошная, смысловая связь пунктирная: две разные вещи не
        // должны выглядеть одинаково, а цветом их разводить нельзя — цвет
        // здесь уже занят категорией
        animated: false,
        style:
          edge.kind === "relation"
            ? { stroke: "var(--accent)", strokeWidth: 1.5, strokeDasharray: "5 4" }
            : { stroke: "var(--line-strong)", strokeWidth: 1.5 },
      })),
    [links],
  );

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return source.filter((node) => node.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, source]);

  const focus = useCallback(
    (id: string) => {
      const node = placed.find((n) => n.id === id);
      if (!node) return;
      const at = moved[id] ?? { x: node.x, y: node.y };
      void flow.setCenter(at.x + NODE_WIDTH / 2, at.y + NODE_HEIGHT / 2, {
        zoom: 1.15,
        duration: 400,
      });
      setPicked(node);
    },
    [flow, placed, moved],
  );

  /*
    Приход с плитки категории: «?focus=<id>» наводит карту на этот узел и
    открывает его панель. Без этого кнопка «Map» обещала бы показать
    категорию, а показывала бы всю карту целиком, где её ещё надо найти.

    Наводим ровно один раз: дальше человек двигает карту сам, и повторное
    центрирование отбирало бы у него управление.
  */
  const params = useSearchParams();
  const wanted = params.get("focus");
  const centred = useRef<string | null>(null);

  useEffect(() => {
    if (!wanted || centred.current === wanted) return;
    if (!placed.some((node) => node.id === wanted)) return;
    centred.current = wanted;
    /*
      Через кадр, а не сразу: наведение меняет и состояние React, и вьюпорт
      React Flow. Синхронно из эффекта это каскадный рендер, который ловит
      правило react-hooks/set-state-in-effect, — а лишний кадр здесь ещё и
      кстати, к нему узлы уже измерены.
    */
    const frame = requestAnimationFrame(() => focus(wanted));
    return () => cancelAnimationFrame(frame);
  }, [wanted, placed, focus]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setPicked(node.data as unknown as GraphNode);
  }, []);

  // Escape снимает выбор — то же, что клик по пустому месту
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative h-[70dvh] min-h-96 overflow-hidden rounded-xl border border-line bg-surface">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        onPaneClick={() => setPicked(null)}
        onNodeDragStop={(_, node) =>
          setMoved((prev) => ({ ...prev, [node.id]: { x: node.position.x, y: node.position.y } }))
        }
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        className="[&_.react-flow\_\_attribution]:!bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line)" />
        <Controls
          showInteractive={false}
          className="!border !border-line !bg-surface !shadow-card [&_button]:!border-line [&_button]:!bg-surface [&_button]:!fill-current [&_button]:!text-muted"
        />
        {/* Миникарта только на широком экране: на телефоне она съедает угол,
            в котором и так тесно */}
        <MiniMap
          pannable
          zoomable
          className="!hidden !rounded-lg !border !border-line !bg-surface sm:!block"
          maskColor="color-mix(in srgb, var(--ink) 10%, transparent)"
          nodeColor={(node) => {
            const data = node.data as unknown as GraphNode;
            return data.color || "var(--accent)";
          }}
        />
      </ReactFlow>

      {/* Поиск поверх полотна: он наводит камеру, а не фильтрует — потерять
          карту из виду ради одного узла было бы обменом не в ту сторону */}
      <div className="absolute left-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a node…"
            aria-label="Find a node on the map"
            className={`${inputClass} pl-11 shadow-card`}
          />
        </div>
        {hits.length > 0 && (
          <ul className="mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-overlay">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => {
                    focus(hit.id);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  <span aria-hidden>{hit.icon || "•"}</span>
                  <span className="truncate">{hit.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <Button size="sm" onClick={() => void flow.fitView({ duration: 400 })}>
          Fit
        </Button>
        {Object.keys(moved).length > 0 && (
          <Button size="sm" onClick={() => setMoved({})} title="Put every node back where the layout put it">
            Reset layout
          </Button>
        )}
      </div>

      <Legend />

      {picked && (
        <NodePanel
          key={picked.id}
          node={picked}
          attachReady={attachReady}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 hidden flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-line bg-surface/95 px-3 py-2 sm:flex">
      <span className="label-micro">Legend</span>
      <span className="flex items-center gap-1.5 text-2xs text-muted">
        <span aria-hidden className="h-px w-5 bg-line-strong" /> Hierarchy
      </span>
      <span className="flex items-center gap-1.5 text-2xs text-muted">
        <span
          aria-hidden
          className="h-0 w-5 border-t-2 border-dashed border-accent"
        />{" "}
        Related
      </span>
      <span className="flex items-center gap-1.5 text-2xs text-muted">
        <span aria-hidden className="text-accent">+n</span> Attached cards
      </span>
    </div>
  );
}
