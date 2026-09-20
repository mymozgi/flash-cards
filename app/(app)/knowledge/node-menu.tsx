"use client";

import type { KnowledgeNode } from "@/lib/knowledge";
import { PopMenu, type PopMenuGroup } from "@/components/ui/pop-menu";

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
  | "group"
  | "study"
  | "cards"
  | "archive"
  | "unarchive"
  | "delete";

const GROUPS: PopMenuGroup<MenuAction>[] = [
  {
    items: [
      { action: "open", label: "Open" },
      { action: "cards", label: "Browse cards" },
      { action: "study", label: "Practice this category" },
    ],
  },
  {
    items: [
      { action: "rename", label: "Rename" },
      { action: "edit", label: "Edit details…" },
      /*
        Пункта «Create subcategory» здесь нет и быть не может. Форма дерева
        закреплена триггером `topics_two_levels`: категория внутри категории
        запрещена базой. Пункт меню, который база отвергнет, — обещание,
        которого интерфейс не сдержит.
      */
      { action: "group", label: "Create flashcard set" },
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
  /*
    Архивация и возврат из архива — одно место в списке и два взаимно
    исключающих пункта: предлагать «Archive» тому, что уже в архиве, значит
    предлагать действие без последствий.
  */
  const groups: PopMenuGroup<MenuAction>[] = GROUPS.map((group) => ({
    items: group.items.flatMap((item) =>
      item.action === "archive"
        ? node.archived
          ? [{ action: "unarchive" as MenuAction, label: "Restore from archive" }]
          : [item]
        : [item],
    ),
  }));

  return (
    <PopMenu title={node.name} groups={groups} at={at} onPick={onPick} onClose={onClose} />
  );
}
