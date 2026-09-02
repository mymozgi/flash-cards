"use client";

import Link from "next/link";
import type { KnowledgeNode } from "@/lib/knowledge";
import { Button, LinkButton } from "@/components/ui/button";
import { MoreIcon } from "@/components/icons";

/**
 * Плитка категории.
 *
 * Отдельная от плитки набора: та отвечает на «что мне сейчас учить» и потому
 * ведёт прогрессом и кнопкой Practice. Эта отвечает на «что у меня есть и как
 * оно устроено» — здесь важнее иконка, объём ветки и путь внутрь.
 *
 * Действий у категории девять, и раскладывать их кнопками по плитке нельзя:
 * они займут больше места, чем само содержимое. Поэтому одно главное действие
 * и меню — то же самое, что в дереве по правой кнопке. Два разных набора
 * действий на один объект — это два разных ответа на вопрос «что я могу с ним
 * сделать», и удаление в своё время оказалось только в одном из них.
 */
export function CategoryCard({
  node,
  counts = true,
  onOpenMenu,
}: {
  node: KnowledgeNode;
  /** Известен ли объём ветки. Неизвестный не показывается вовсе. */
  counts?: boolean;
  /** Без обработчика кнопки меню нет: кнопка, которая ничего не делает, хуже её отсутствия. */
  onOpenMenu?: (anchor: { x: number; y: number }) => void;
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
            <h3 className="truncate text-lg font-semibold leading-tight">
              {node.name}
              {node.archived && <span className="ml-2 text-2xs text-faint">archived</span>}
            </h3>
          </Link>
          {/* Тема в корне — законное переходное состояние: набор сделали
              раньше, чем занялись раскладкой. Назвать его прямо честнее, чем
              выдавать за категорию. */}
          {node.kind === "deck" ? (
            <p className="mt-1 text-sm text-muted">
              A topic, not filed into a category yet
            </p>
          ) : (
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              {node.description || "No description"}
            </p>
          )}
        </div>
      </div>

      {/* Счётчики по всей ветке, а не по самому узлу: «42 cards» у Psychology
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
        {onOpenMenu && (
          <Button
            size="icon"
            onClick={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              onOpenMenu({ x: box.right - 224, y: box.bottom });
            }}
            aria-haspopup="menu"
            aria-label={`Actions for ${node.name}`}
            title="Rename, move, archive, delete…"
          >
            <MoreIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
