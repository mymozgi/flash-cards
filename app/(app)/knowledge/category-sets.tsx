"use client";

import { DeckCard } from "@/components/deck-card";
import { useDeleteSet } from "@/components/use-delete-set";
import type { DeckSummary } from "@/lib/types";

/**
 * Наборы внутри категории.
 *
 * Клиентская обёртка вокруг плиток: удаление требует подтверждения, а
 * подтверждение — состояния. Сама плитка остаётся представлением и получает
 * только обработчик.
 */
export function CategorySets({ sets }: { sets: DeckSummary[] }) {
  const { remove, dialog, toast, notice, busy } = useDeleteSet();

  return (
    <>
      {dialog}
      {toast}
      {notice}

      <ul className={`mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
        {sets.map((deck) => (
          <li key={deck.id}>
            <DeckCard deck={deck} onDelete={() => remove(deck)} />
          </li>
        ))}
      </ul>
    </>
  );
}
