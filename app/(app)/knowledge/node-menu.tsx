"use client";

import { useEffect, useRef } from "react";
import type { KnowledgeNode } from "@/lib/knowledge";

/**
 * Меню узла.
 *
 * Открывается и по правой кнопке, и по нажатию на имя: правая кнопка на
 * телефоне недоступна, а прятать половину действий от половины устройств
 * нельзя.
 *
 * Разрушающие действия отмечены тоном, но подтверждение спрашивает не меню —
 * его спрашивает тот, кто действие выполняет. Меню только называет намерение.
 */
export type MenuAction =
  | "open"
  | "rename"
  | "edit"
  | "subcategory"
  | "group"
  | "study"
  | "cards"
  | "archive"
  | "unarchive"
  | "delete";

const GROUPS: { items: { action: MenuAction; label: string; danger?: boolean }[] }[] = [
  {
    items: [
      { action: "open", label: "Open" },
      { action: "cards", label: "Browse cards" },
      { action: "study", label: "Practice this branch" },
    ],
  },
  {
    items: [
      { action: "rename", label: "Rename" },
      { action: "edit", label: "Edit details…" },
      { action: "subcategory", label: "Create subcategory" },
      { action: "group", label: "Create flashcard group" },
    ],
  },
  {
    items: [
      { action: "archive", label: "Archive" },
      { action: "delete", label: "Delete…", danger: true },
    ],
  },
];

export function NodeMenu({
  node,
  at,
  onPick,
  onClose,
}: {
  node: KnowledgeNode;
  at: { x: number; y: number };
  onPick: (action: MenuAction) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // capture: иначе клик успеет сработать на элементе под меню
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    box.current?.querySelector("button")?.focus();
  }, []);

  return (
    <div
      ref={box}
      role="menu"
      aria-label={`Actions for ${node.name}`}
      // Прижимаем к краю окна: у нижних строк длинного дерева меню иначе
      // раскрывалось бы за пределы экрана
      style={{
        left: Math.min(at.x, (typeof window === "undefined" ? 1024 : window.innerWidth) - 236),
        top: Math.min(at.y + 6, (typeof window === "undefined" ? 768 : window.innerHeight) - 340),
      }}
      className="fixed z-50 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-overlay"
    >
      <p className="truncate px-3 py-2 label-micro">{node.name}</p>
      {GROUPS.map((group, index) => {
        const items = group.items.filter((item) =>
          item.action === "archive" && node.archived ? false : true,
        );
        return (
          <div key={index} className={index > 0 ? "border-t border-line pt-1" : ""}>
            {node.archived && index === 2 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => onPick("unarchive")}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                Restore from archive
              </button>
            )}
            {items.map((item) => (
              <button
                key={item.action}
                type="button"
                role="menuitem"
                onClick={() => onPick(item.action)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 ${
                  item.danger ? "text-rust" : ""
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
