"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkUpdate, type BulkOp } from "./actions";

export type LibraryCard = {
  id: string;
  front: string;
  back: string;
  topicId: string | null;
  topicPath: string | null;
  tags: string[];
  suspended: boolean;
  state: string;
  thumbUrl: string | null;
};

const STATE_LABELS: Record<string, string> = {
  new: "new",
  learning: "learning",
  review: "review",
  relearning: "relearning",
};

export function CardList({ cards }: { cards: LibraryCard[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (op: Omit<BulkOp, "cardIds">) => {
    const cardIds = [...selected];
    if (cardIds.length === 0) return;
    if (op.action === "delete" && !confirm(`Delete ${cardIds.length} card(s)?`)) return;

    startTransition(async () => {
      const res = await bulkUpdate({ ...op, cardIds });
      if (!res.ok) {
        setError(res.error ?? "The operation failed");
        return;
      }
      setSelected(new Set());
      setError(null);
      router.refresh();
    });
  };

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 -mx-5 mb-3 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3 text-sm sm:mx-0 sm:rounded sm:border">
          <span className="font-mono text-xs tabular-nums text-faint">
            {selected.size} selected
          </span>
          <button type="button" onClick={() => run({ action: "suspend" })} className="rounded border border-line px-3 py-1.5">
            Suspend
          </button>
          <button type="button" onClick={() => run({ action: "unsuspend" })} className="rounded border border-line px-3 py-1.5">
            Resume
          </button>
          <button
            type="button"
            onClick={() => {
              const tags = prompt("Tags, comma separated");
              if (tags) run({ action: "add_tags", tags });
            }}
            className="rounded border border-line px-3 py-1.5"
          >
            Add tags
          </button>
          <button
            type="button"
            onClick={() => {
              const topicPath = prompt("New topic — path separated by /");
              if (topicPath !== null) run({ action: "move_topic", topicPath });
            }}
            className="rounded border border-line px-3 py-1.5"
          >
            Move to topic
          </button>
          <button type="button" onClick={() => run({ action: "delete" })} className="rounded border border-line px-3 py-1.5 text-rust">
            Delete
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-faint">
            Clear selection
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <ul className={`divide-y divide-line rounded border border-line bg-surface ${pending ? "opacity-60" : ""}`}>
        {cards.map((card) => (
          <li key={card.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
            <input
              type="checkbox"
              checked={selected.has(card.id)}
              onChange={() => toggle(card.id)}
              aria-label="Select card"
              className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
            />
            {card.thumbUrl && (
              <img
                src={card.thumbUrl}
                alt=""
                width={40}
                height={40}
                className="mt-0.5 size-10 shrink-0 rounded border border-line object-cover"
              />
            )}
            {/* Редактор один — конструктор колоды. У карточки без колоды
                редактировать негде, поэтому строка не кликается: сначала
                её нужно назначить в набор массовой операцией. */}
            <Link
              href={card.topicId ? `/decks/${card.topicId}` : "/library"}
              aria-disabled={!card.topicId}
              className={`min-w-0 flex-1 ${card.topicId ? "" : "pointer-events-none"}`}
            >
              <p className="truncate text-sm font-medium">{card.front}</p>
              <p className="truncate text-sm text-muted">{card.back}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs uppercase tracking-[0.12em] text-faint">
                <span>{card.topicPath ?? "no deck — assign one to edit"}</span>
                <span>·</span>
                <span>{STATE_LABELS[card.state] ?? card.state}</span>
                {card.suspended && <span className="text-rust">· suspended</span>}
                {card.tags.map((tag) => (
                  <span key={tag} className="normal-case tracking-normal">
                    #{tag}
                  </span>
                ))}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
