"use client";

import { useMemo, useRef, useState } from "react";
import type { KnowledgeNode } from "@/lib/knowledge";
import { ChevronIcon, GripIcon } from "@/components/icons";
import { canDrop, type DropZone as Zone } from "@/lib/knowledge-tree";

/**
 * Дерево знаний с переносом узлов.
 *
 * Отличие от переноса карточек в конструкторе принципиальное: там список
 * плоский и зон сброса две — выше и ниже. Здесь их три, и третья, «внутрь»,
 * и есть то, ради чего дерево существует. Различаются они по вертикали внутри
 * строки: верхняя четверть — встать перед, нижняя четверть — встать после,
 * середина — вложить внутрь. Так одно движение пальца выражает и порядок, и
 * вложенность, без модификаторов и без отдельного режима.
 *
 * Петли и превышение глубины не проверяются здесь: это делает триггер в базе.
 * Но очевидные промахи гасятся сразу — узел не подсвечивает как цель самого
 * себя и собственных потомков, иначе интерфейс предлагал бы действие, которое
 * заведомо будет отклонено.
 */
export type DropZone = Zone;

export type TreeMove = {
  dragId: string;
  targetId: string;
  zone: DropZone;
};

const LONG_PRESS_MS = 250;
const MOVE_CANCEL_PX = 8;
/** Доля высоты строки сверху и снизу, отданная под «встать рядом». */
const EDGE_BAND = 0.28;

export function TreeView({
  roots,
  collapsed,
  onToggle,
  onMove,
  onOpenMenu,
  busy = false,
}: {
  roots: KnowledgeNode[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onMove: (move: TreeMove) => void;
  onOpenMenu: (node: KnowledgeNode, anchor: { x: number; y: number }) => void;
  busy?: boolean;
}) {
  const [drag, setDrag] = useState<{ id: string; name: string } | null>(null);
  const [over, setOver] = useState<{ id: string; zone: DropZone } | null>(null);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());

  /*
    Плоский список для проверок. Правила «куда можно уронить» живут в
    lib/knowledge-tree и покрыты тестами: своя копия здесь уже успела
    разойтись с базой — она разрешала поставить родителя рядом с его же
    потомком, то есть создать петлю, которую триггер потом отклонял.
  */
  const flat = useMemo(() => {
    const out: { id: string; parentId: string | null }[] = [];
    const walk = (list: KnowledgeNode[]) => {
      for (const node of list) {
        out.push({ id: node.id, parentId: node.parentId });
        walk(node.children);
      }
    };
    walk(roots);
    return out;
  }, [roots]);

  const cancelPress = () => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  };

  const zoneAt = (element: HTMLElement, clientY: number): DropZone => {
    const rect = element.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    if (ratio < EDGE_BAND) return "before";
    if (ratio > 1 - EDGE_BAND) return "after";
    return "inside";
  };

  const findTarget = (clientY: number) => {
    for (const [id, element] of rows.current) {
      const rect = element.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return { id, element };
    }
    return null;
  };

  const grip = (node: KnowledgeNode) => ({
    onPointerDown: (event: React.PointerEvent) => {
      if (event.button !== 0 || busy) return;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      const begin = () => setDrag({ id: node.id, name: node.name });

      if (event.pointerType === "mouse") {
        event.preventDefault();
        begin();
        return;
      }
      // с касания — по удержанию, иначе страница перестанет прокручиваться
      press.current = {
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          press.current = null;
          begin();
        }, LONG_PRESS_MS),
      };
    },

    onPointerMove: (event: React.PointerEvent) => {
      const waiting = press.current;
      if (waiting) {
        if (
          Math.abs(event.clientX - waiting.x) > MOVE_CANCEL_PX ||
          Math.abs(event.clientY - waiting.y) > MOVE_CANCEL_PX
        ) {
          cancelPress();
        }
        return;
      }
      if (!drag) return;
      event.preventDefault();

      const hit = findTarget(event.clientY);
      if (!hit) {
        setOver(null);
        return;
      }
      const zone = zoneAt(hit.element, event.clientY);
      if (!canDrop(flat, drag.id, hit.id, zone)) {
        setOver(null);
        return;
      }
      setOver({ id: hit.id, zone });
    },

    onPointerUp: () => {
      cancelPress();
      if (drag && over) onMove({ dragId: drag.id, targetId: over.id, zone: over.zone });
      setDrag(null);
      setOver(null);
    },

    onPointerCancel: () => {
      cancelPress();
      setDrag(null);
      setOver(null);
    },
  });

  const render = (nodes: KnowledgeNode[]): React.ReactNode =>
    nodes.map((node) => {
      const hidden = collapsed.has(node.id);
      const mark = over?.id === node.id ? over.zone : null;
      const lifted = drag?.id === node.id;

      return (
        <li key={node.id}>
          <div
            ref={(el) => {
              if (el) rows.current.set(node.id, el);
              else rows.current.delete(node.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onOpenMenu(node, { x: event.clientX, y: event.clientY });
            }}
            style={{ paddingLeft: `${node.depth * 20}px` }}
            className={`relative flex min-h-12 items-center gap-2 rounded-lg pr-2 transition-colors ${
              lifted ? "opacity-45" : ""
            } ${mark === "inside" ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-surface-2"}`}
          >
            {/* Линия вставки: она и есть ответ на «куда именно встанет» */}
            {mark === "before" && (
              <span aria-hidden className="absolute inset-x-2 top-0 h-0.5 rounded bg-accent" />
            )}
            {mark === "after" && (
              <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-accent" />
            )}

            <span
              {...grip(node)}
              aria-label={`Move ${node.name}`}
              title="Drag to move; drop on a row to nest, on its edge to reorder"
              className="-m-1 cursor-grab touch-none rounded p-1 text-faint hover:text-ink active:cursor-grabbing"
            >
              <GripIcon />
            </span>

            <button
              type="button"
              onClick={() => onToggle(node.id)}
              aria-expanded={!hidden}
              aria-label={hidden ? `Expand ${node.name}` : `Collapse ${node.name}`}
              disabled={node.children.length === 0}
              style={{ transform: hidden ? "rotate(-90deg)" : undefined }}
              className="flex size-6 items-center justify-center rounded text-faint transition-transform duration-200 hover:text-ink disabled:opacity-0"
            >
              <ChevronIcon />
            </button>

            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-md text-sm"
              style={{
                background: `color-mix(in srgb, ${node.color || "var(--accent)"} 16%, var(--surface))`,
              }}
            >
              {node.icon || node.name.trim().charAt(0).toUpperCase()}
            </span>

            <button
              type="button"
              onClick={(event) =>
                onOpenMenu(node, { x: event.clientX, y: event.currentTarget.getBoundingClientRect().bottom })
              }
              className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent"
            >
              {node.name}
              {node.archived && <span className="ml-2 text-2xs text-faint">archived</span>}
            </button>

            <span className="label-micro shrink-0 tabular-nums">{node.cards}</span>
          </div>

          {!hidden && node.children.length > 0 && <ul>{render(node.children)}</ul>}
        </li>
      );
    });

  if (roots.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface py-16 text-center text-sm text-muted">
        Nothing here yet. Create a category to start the tree.
      </p>
    );
  }

  return (
    <>
      <ul className={`flex flex-col ${busy ? "opacity-60" : ""}`}>{render(roots)}</ul>
      {drag && (
        <p aria-live="polite" className="mt-3 text-sm text-muted">
          Moving <strong>{drag.name}</strong>
          {over ? (
            <>
              {" "}
              — drop to place it{" "}
              {over.zone === "inside" ? "inside" : over.zone === "before" ? "above" : "below"} this row
            </>
          ) : (
            " — hover a row: middle nests it, edges reorder"
          )}
        </p>
      )}
    </>
  );
}
