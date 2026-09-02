"use client";

import Link from "next/link";
import type { KnowledgeNode } from "@/lib/knowledge";
import { Button, LinkButton } from "@/components/ui/button";
import { PencilIcon } from "@/components/icons";

/**
 * Плитка категории.
 *
 * Отдельная от плитки набора: та отвечает на «что мне сейчас учить» и потому
 * ведёт прогрессом и кнопкой Practice. Эта отвечает на «что у меня есть и как
 * оно устроено» — здесь важнее иконка, объём ветки и путь внутрь, а не доля
 * выученного. Общий у них дизайн-язык, а не код.
 */
export function CategoryCard({
  node,
  counts = true,
  canArchive,
  onRename,
  onArchive,
}: {
  node: KnowledgeNode;
  /** Известен ли объём ветки. Неизвестный не показывается вовсе. */
  counts?: boolean;
  canArchive: boolean;
  onRename: () => void;
  onArchive: () => void;
}) {
  const tint = node.color || "var(--accent)";

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-lg text-2xl"
          style={{ background: `color-mix(in srgb, ${tint} 14%, var(--surface))` }}
        >
          {node.icon || node.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/knowledge/${node.id}`} className="block">
            <h3 className="truncate text-lg font-semibold leading-tight">{node.name}</h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {node.description || "No description"}
          </p>
        </div>
      </div>

      {/* Счётчики по всей ветке, а не по самому узлу: «42 items» у Psychology
          означает всё, что лежит под ней, иначе число врало бы про объём. */}
      {counts && (
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="label-micro">
          <span className="tabular-nums">{node.cards}</span>{" "}
          {node.cards === 1 ? "card" : "cards"}
        </span>
        <span className="label-micro">
          <span className="tabular-nums">{node.descendants}</span>{" "}
          {node.descendants === 1 ? "subcategory" : "subcategories"}
        </span>
      </p>
      )}

      <div className="mt-auto flex items-stretch gap-2">
        <LinkButton href={`/knowledge/${node.id}`} tone="soft" className="flex-1">
          Open
        </LinkButton>
        <Button size="icon" onClick={onRename} aria-label={`Rename ${node.name}`} title="Rename">
          <PencilIcon />
        </Button>
        {canArchive && (
          <Button
            size="sm"
            onClick={onArchive}
            aria-label={`Archive ${node.name}`}
            title="Hide it from the lists; the cards inside stay"
          >
            Archive
          </Button>
        )}
      </div>
    </div>
  );
}
