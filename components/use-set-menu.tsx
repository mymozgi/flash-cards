"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PopMenu, type PopMenuGroup } from "@/components/ui/pop-menu";
import { useDeleteSet } from "@/components/use-delete-set";
import { duplicateSet, updateCategory } from "@/app/(app)/knowledge/actions";
import { withOrigin } from "@/lib/back";
import type { DeckSummary } from "@/lib/types";

type SetAction =
  | "open"
  | "edit"
  | "practice"
  | "browse"
  | "cards"
  | "duplicate"
  | "archive"
  | "delete";

/**
 * Действия над набором.
 *
 * Уровни не смешиваются: здесь только то, что делают С НАБОРОМ. Правка
 * отдельной карточки, её перенос и порядок живут внутри набора, на экране
 * конструктора, и подниматься сюда им незачем — иначе меню набора начнёт
 * отвечать за карточки, а меню категории за наборы.
 *
 * «Move cards» — исключение только на вид: это не правка карточек, а вход в
 * то место, где их отмечают и переносят пачкой.
 */
export function useSetMenu(
  /** Откуда открыто меню: набор вернёт человека сюда же. */
  from?: string,
) {
  const open_ = (href: string) => (from ? withOrigin(href, from) : href);

  const [at, setAt] = useState<{ deck: DeckSummary; x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const del = useDeleteSet();

  const open = (deck: DeckSummary, anchor: { x: number; y: number }) =>
    setAt({ deck, ...anchor });

  const pick = (action: SetAction) => {
    const deck = at?.deck;
    setAt(null);
    if (!deck) return;

    switch (action) {
      case "open":
      case "cards":
      case "edit":
        // Правка набора живёт в его же шапке: отдельная форма означала бы
        // второе место, где задают имя, описание и обложку
        router.push(open_(`/decks/${deck.id}`));
        return;
      case "practice":
        router.push(`/review?free=1&topic=${deck.id}`);
        return;
      case "browse":
        router.push(`/decks/${deck.id}/study`);
        return;
      case "duplicate":
        startTransition(async () => {
          const res = await duplicateSet(deck.id);
          if (!res.ok) {
            setError(res.error ?? "Could not duplicate the set");
            return;
          }
          setError(null);
          router.refresh();
        });
        return;
      case "archive":
        startTransition(async () => {
          const res = await updateCategory(deck.id, { archived: true });
          if (!res.ok) {
            setError(res.error ?? "Could not archive the set");
            return;
          }
          setError(null);
          router.refresh();
        });
        return;
      case "delete":
        void del.remove(deck);
        return;
    }
  };

  const groups = (deck: DeckSummary): PopMenuGroup<SetAction>[] => [
    {
      items: [
        { action: "open", label: "Open" },
        // Пустому набору нечего практиковать и нечего листать: предлагать
        // это значит обещать экран, на котором ничего не будет
        ...(deck.total > 0
          ? ([
              { action: "practice", label: "Practice" },
              { action: "browse", label: "Browse" },
            ] as const)
          : []),
      ],
    },
    {
      items: [
        { action: "edit", label: "Edit set" },
        { action: "cards", label: deck.total > 0 ? "Move cards" : "Add cards" },
        /*
          Дублируется оболочка: имя, описание, цвет, иконка и та же
          категория. Карточки НЕ копируются, и подпись говорит об этом
          прямо — иначе человек ждал бы копию содержимого.

          Копий карточек в этом проекте не создают никогда: две копии
          одного знания дают две истории повторений, и обе врут — учат
          одно, а расписание считает, что двое.
        */
        { action: "duplicate", label: "Duplicate (empty copy)" },
      ],
    },
    {
      items: [
        { action: "archive", label: "Archive" },
        { action: "delete", label: "Delete set…", danger: true },
      ],
    },
  ];

  const menu = (
    <>
      {del.dialog}
      {del.toast}
      {at && (
        <PopMenu
          title={at.deck.name}
          groups={groups(at.deck)}
          at={{ x: at.x, y: at.y }}
          onPick={pick}
          onClose={() => setAt(null)}
        />
      )}
    </>
  );

  const notice =
    error !== null ? (
      <p role="alert" className="mt-3 rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
        {error}
      </p>
    ) : (
      del.notice
    );

  return { open, menu, notice, busy: busy || del.busy };
}
