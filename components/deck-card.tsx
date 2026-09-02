"use client";

import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/panel";
import { TrashIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import type { DeckSummary } from "@/lib/types";

export type { DeckSummary };

/**
 * Карточка набора. Один компонент на два экрана — список наборов и «Сегодня»:
 * иначе они начнут расходиться, как уже разошлись два редактора карточки.
 */
export function DeckCard({
  deck,
  readOnly = false,
  selecting = false,
  selected = false,
  onToggle,
}: {
  deck: DeckSummary;
  /** Гостевой режим: тренировка пишет оценки, правка меняет данные — обе скрыты. */
  readOnly?: boolean;
  /* Режим выбора нужен только списку наборов. На «Сегодня» карточка
     показывается без него — из серверного компонента функцию-заглушку
     передать нельзя, туда уезжают только серверные действия. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const ratio = deck.total === 0 ? 0 : Math.round((deck.memorized / deck.total) * 100);

  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-surface p-5 shadow-card ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge
          style={
            deck.color ? { background: `${deck.color}22`, color: deck.color } : undefined
          }
        >
          {deck.category ?? "No category"}
        </Badge>
        {selecting && !readOnly ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle?.()}
            aria-label={`Select ${deck.name}`}
            className="size-4 accent-[var(--accent)]"
          />
        ) : (
          <Link
            href={`/decks/${deck.id}`}
            aria-label={`Edit ${deck.name}`}
            className="text-faint hover:text-ink"
          >
            <TrashIcon className="size-4 opacity-0" />
          </Link>
        )}
      </div>

      <Link href={`/decks/${deck.id}`} className="mt-3 block">
        <h2 className="text-lg font-semibold leading-tight">{deck.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {deck.description || "No description"}
        </p>
      </Link>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <span className="label-micro">Cards memorized</span>
          <span className="text-xs font-semibold tabular-nums text-muted">
            {deck.memorized}/{deck.total}
          </span>
        </div>
        <Progress
          value={deck.memorized}
          max={deck.total}
          label={`${ratio}% memorized in ${deck.name}`}
          className="mt-1.5"
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
        <span>
          {deck.total} {deck.total === 1 ? "card" : "cards"}
        </span>
        <span>
          {deck.lastUsed
            ? `Last used ${new Date(deck.lastUsed).toLocaleDateString()}`
            : "Not studied yet"}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        {/* Practice — то, ради чего набор открывают. Он и должен выглядеть
            как главное действие, а правка и просмотр — как вспомогательные. */}
        {readOnly ? (
          <LinkButton href={`/decks/${deck.id}/study`} tone="soft" className="flex-1">
            Browse cards
          </LinkButton>
        ) : (
          <>
            <LinkButton
              href={`/review?free=1&topic=${deck.id}`}
              tone="soft"
              className="flex-[2]"
            >
              Practice
            </LinkButton>
            <LinkButton href={`/decks/${deck.id}/study`} size="sm" className="flex-1">
              Browse
            </LinkButton>
            <LinkButton href={`/decks/${deck.id}`} tone="ghost" size="sm" className="flex-1">
              Edit
            </LinkButton>
          </>
        )}
      </div>
    </div>
  );
}
