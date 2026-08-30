"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { purgeCard, restoreCard } from "./actions";
import { TrashIcon } from "@/components/icons";

export type TrashedCard = {
  id: string;
  front: string;
  back: string;
  deletedAt: string;
  purgeAt: string;
};

export function TrashList({ cards }: { cards: TrashedCard[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "The operation failed");
      else router.refresh();
    });

  if (cards.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">The trash is empty.</p>;
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}
      <ul className={`divide-y divide-line rounded-xl border border-line bg-surface ${busy ? "opacity-60" : ""}`}>
        {cards.map((card) => (
          <li key={card.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{card.front}</p>
              <p className="truncate text-sm text-muted">{card.back}</p>
              <p className="mt-1 text-xs text-faint">
                Deleted {new Date(card.deletedAt).toLocaleDateString()} · purged on{" "}
                {new Date(card.purgeAt).toLocaleDateString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => run(() => restoreCard(card.id))}
              className="rounded-lg border border-line px-3 py-1.5 text-sm"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this card for good?")) run(() => purgeCard(card.id));
              }}
              aria-label="Delete for good"
              className="p-1.5 text-faint hover:text-rust"
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
