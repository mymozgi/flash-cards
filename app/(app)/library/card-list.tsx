"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkUpdate, type BulkOp } from "./actions";
import { useConfirm } from "@/components/ui/confirm";
import { Button } from "@/components/ui/button";

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

export function CardList({
  cards,
  readOnly = false,
}: {
  cards: LibraryCard[];
  /** Гостевой режим: выбор и массовые операции скрыты, строка ведёт в просмотр. */
  readOnly?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();
  const router = useRouter();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async (op: Omit<BulkOp, "cardIds">) => {
    const cardIds = [...selected];
    if (cardIds.length === 0) return;

    if (op.action === "delete") {
      const confirmed = await ask({
        title: `Delete ${cardIds.length} ${cardIds.length === 1 ? "card" : "cards"}?`,
        description: "They move to the trash and can be restored within 30 days.",
        confirmLabel: "Move to trash",
      });
      if (!confirmed) return;
    }

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
      {dialog}
      {!readOnly && selected.size > 0 && (
        <div className="sticky top-0 z-10 -mx-5 mb-3 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-5 py-3 text-sm sm:mx-0 sm:rounded sm:border">
          <span className="font-mono text-xs tabular-nums text-faint">
            {selected.size} selected
          </span>
          <Button size="sm" onClick={() => run({ action: "suspend" })}>
            Suspend
          </Button>
          <Button size="sm" onClick={() => run({ action: "unsuspend" })}>
            Resume
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const tags = prompt("Tags, comma separated");
              if (tags) run({ action: "add_tags", tags });
            }}
          >
            Add tags
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const topicPath = prompt("New topic — path separated by /");
              if (topicPath !== null) run({ action: "move_topic", topicPath });
            }}
          >
            Move to topic
          </Button>
          <Button tone="danger" size="sm" onClick={() => run({ action: "delete" })}>
            Delete
          </Button>
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
            {!readOnly && (
              <input
                type="checkbox"
                checked={selected.has(card.id)}
                onChange={() => toggle(card.id)}
                aria-label="Select card"
                className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
              />
            )}
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
              href={
                card.topicId
                  ? readOnly
                    ? `/decks/${card.topicId}/study`
                    : `/decks/${card.topicId}`
                  : "/library"
              }
              aria-disabled={!card.topicId}
              className={`min-w-0 flex-1 ${card.topicId ? "" : "pointer-events-none"}`}
            >
              <p className="truncate text-sm font-medium">{card.front}</p>
              <p className="truncate text-sm text-muted">{card.back}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 label-micro">
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
