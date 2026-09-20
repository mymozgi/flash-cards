"use client";

import Link from "next/link";
import type { KnowledgeNode } from "@/lib/knowledge";
import { Button, LinkButton } from "@/components/ui/button";
import { ListIcon, MoreIcon, PencilIcon } from "@/components/icons";

/** Сколько наборов показать в предпросмотре. Дальше — «View all». */
const PREVIEW = 3;

/**
 * Плитка категории.
 *
 * Отличается от плитки набора намеренно и по существу, а не оформлением.
 * Плитка набора отвечает на «что мне сейчас учить»: обложка, прогресс, когда
 * повторяли, кнопка Practice. Эта отвечает на «что у меня есть и как оно
 * устроено»: сколько наборов, сколько карточек и какие наборы внутри.
 *
 * Прогресса здесь нет сознательно. Усвоенность — свойство карточки и набора,
 * у папки её нет: «категория выучена на 40%» не значит ничего, потому что
 * категория ничему не учит. Показать её тут значило бы поставить два разных
 * ответа на один вопрос в двух местах.
 */
export function CategoryCard({
  node,
  counts = true,
  onOpenMenu,
  onEdit,
}: {
  node: KnowledgeNode;
  /** Известен ли объём ветки. Неизвестный не показывается вовсе. */
  counts?: boolean;
  /** Без обработчика кнопки меню нет: кнопка, которая ничего не делает, хуже её отсутствия. */
  onOpenMenu?: (anchor: { x: number; y: number }) => void;
  onEdit?: () => void;
}) {
  const tint = node.color || "var(--accent)";
  const sets = node.children;
  const shown = sets.slice(0, PREVIEW);
  const rest = sets.length - shown.length;

  /*
    Тема в корне — законное переходное состояние: набор сделали раньше, чем
    занялись раскладкой. Она не категория, внутри у неё карточки, а не наборы,
    поэтому и предпросмотр наборов ей показывать не из чего.
  */
  const isLooseTopic = node.kind === "deck";

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-card">
      {/* ── шапка ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-lg text-2xl"
          style={{ background: `color-mix(in srgb, ${tint} 14%, var(--surface))` }}
        >
          {node.icon || node.name.trim().charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <span className="label-micro" style={{ color: tint }}>
            {isLooseTopic ? "Unfiled topic" : "Category"}
          </span>
          <Link href={`/knowledge/${node.id}`} className="mt-0.5 block">
            <h3 className="truncate text-lg font-semibold leading-tight">
              {node.name}
              {node.archived && <span className="ml-2 text-2xs text-faint">archived</span>}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted">
            {isLooseTopic
              ? "A topic, not filed into a category yet"
              : node.description || "No description"}
          </p>
        </div>

        {/* Меню в углу шапки: это действия НАД категорией, а не в ней, и
            стоять им рядом с «Open category» незачем. */}
        {onOpenMenu && (
          <Button
            size="icon"
            tone="ghost"
            className="-mr-2 -mt-2 shrink-0"
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

      {/* ── что внутри, числом ────────────────────────────────── */}
      {counts && (
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
          {!isLooseTopic && (
            <span className="label-micro">
              <span className="tabular-nums">{sets.length}</span>{" "}
              {sets.length === 1 ? "set" : "sets"}
            </span>
          )}
          {/* Счётчик по всей ветке: «70 cards» у XR это всё, что под ней,
              иначе число врало бы про объём. */}
          <span className="label-micro">
            <span className="tabular-nums">{node.cards}</span>{" "}
            {node.cards === 1 ? "card" : "cards"}
          </span>
        </p>
      )}

      {/* ── наборы внутри ─────────────────────────────────────── */}
      {!isLooseTopic && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-micro">Sets inside</span>
            {sets.length > PREVIEW && (
              <Link
                href={`/knowledge/${node.id}`}
                className="text-xs text-accent hover:underline"
              >
                View all →
              </Link>
            )}
          </div>

          {sets.length === 0 ? (
            /* Пустая категория — это не поломка, а начало. Говорим прямо,
               чем её наполнить, вместо пустого места. */
            <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-faint">
              No sets yet — open the category to add one
            </p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {shown.map((set) => (
                <li key={set.id}>
                  {/* Наборы выглядят вложенным содержимым, а не отдельными
                      плитками: без рамки и фона, одной строкой. */}
                  <Link
                    href={`/decks/${set.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-2"
                  >
                    <span aria-hidden className="shrink-0 text-faint">
                      {set.icon || <ListIcon />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{set.name}</span>
                    <span className="shrink-0 tabular-nums text-xs text-faint">
                      {set.cards}
                    </span>
                  </Link>
                </li>
              ))}
              {rest > 0 && (
                <li className="px-2 pt-1 text-xs text-faint">and {rest} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* ── действия ──────────────────────────────────────────── */}
      <div className="mt-auto flex items-stretch gap-2 pt-4">
        {/*
          Одно главное действие вместо трёх равноправных. Карта убрана: она
          отвечает на вопрос «как всё устроено целиком», и задают его не с
          плитки одной категории, а из общего вида — ссылка на карту там и
          осталась.
        */}
        <LinkButton
          href={`/knowledge/${node.id}`}
          tone="primary"
          size="lg"
          className="min-w-0 flex-1"
        >
          <span className="truncate">{isLooseTopic ? "Open topic" : "Open category"}</span>
        </LinkButton>
        {onEdit && (
          <Button
            size="icon"
            onClick={onEdit}
            aria-label={`Edit ${node.name}`}
            title="Edit name, description, icon, colour"
          >
            <PencilIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
