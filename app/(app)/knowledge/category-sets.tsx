"use client";

import { DeckCard } from "@/components/deck-card";
import { useSetMenu } from "@/components/use-set-menu";
import type { DeckSummary } from "@/lib/types";

/**
 * Наборы внутри категории.
 *
 * Клиентская обёртка вокруг плиток: меню действий требует состояния, а
 * удаление — подтверждения. Сама плитка остаётся представлением и получает
 * только обработчик.
 */
export function CategorySets({ sets }: { sets: DeckSummary[] }) {
  const { open, menu, notice, busy } = useSetMenu();

  return (
    <>
      {menu}
      {notice}

      <ul className={`mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
        {sets.map((deck) => (
          <li key={deck.id}>
            <DeckCard deck={deck} onOpenMenu={(at) => open(deck, at)} />
          </li>
        ))}
      </ul>
    </>
  );
}
