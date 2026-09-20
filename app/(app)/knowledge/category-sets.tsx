"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeckCard } from "@/components/deck-card";
import { useSetMenu } from "@/components/use-set-menu";
import { Button } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import type { DeckSummary } from "@/lib/types";
import { archiveSets, removeSets } from "./actions";
import { NewSetButton } from "./new-set-button";

/**
 * Наборы внутри категории: выбор, массовые действия и меню у каждого.
 *
 * Отдельного режима «управление наборами» нет намеренно. Управление живёт
 * там, где наборы лежат: выбрать один и удалить — то же движение, что
 * выбрать несколько и удалить, и уводить ради него на другой экран значит
 * добавлять шаг к самому частому действию.
 */
export function CategorySets({
  sets,
  categoryId,
  categoryPath,
}: {
  sets: DeckSummary[];
  categoryId: string;
  categoryPath: string;
}) {
  const menu = useSetMenu();
  const { ask, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const chosen = sets.filter((deck) => picked.has(deck.id));
  const cards = chosen.reduce((sum, deck) => sum + deck.total, 0);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removeChosen = async () => {
    if (chosen.length === 0) return;

    /*
      Подтверждение перечисляет наборы поимённо, а не только считает их.
      «Удалить 3 набора?» скрывает, какие именно: отметить лишний на
      странице из двенадцати плиток легко, а заметить это по числу — нет.
    */
    const confirmed = await ask({
      title: `Delete ${chosen.length} ${chosen.length === 1 ? "set" : "sets"}?`,
      description: (
        <>
          <p>You are about to permanently delete:</p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {chosen.map((deck) => (
              <li key={deck.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{deck.name}</span>
                <span className="shrink-0 tabular-nums">
                  {deck.total} {deck.total === 1 ? "card" : "cards"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-semibold text-ink">
            {chosen.length} {chosen.length === 1 ? "set" : "sets"} · {cards}{" "}
            {cards === 1 ? "flashcard" : "flashcards"}
          </p>
          <p className="mt-1">
            Every flashcard inside them is deleted too, along with its review
            history. This cannot be undone.
          </p>
        </>
      ),
      confirmLabel: `Delete ${chosen.length} ${chosen.length === 1 ? "set" : "sets"}`,
      tone: "danger",
    });
    if (!confirmed) return;

    startTransition(async () => {
      const res = await removeSets(chosen.map((deck) => deck.id));
      if (!res.ok) {
        setError(res.error ?? "Could not delete the sets");
        return;
      }
      setError(null);
      show(
        chosen.length === 1
          ? `“${chosen[0].name}” was deleted.`
          : `${chosen.length} sets and ${cards} ${
              cards === 1 ? "flashcard" : "flashcards"
            } were deleted.`,
      );
      setPicked(new Set());
      // Счётчики категории пересчитывает сервер: вторая арифметика на
      // клиенте разошлась бы с первой на первом же особом случае
      router.refresh();
    });
  };

  const archiveChosen = () => {
    if (chosen.length === 0) return;
    startTransition(async () => {
      const res = await archiveSets(chosen.map((deck) => deck.id));
      if (!res.ok) {
        setError(res.error ?? "Could not archive the sets");
        return;
      }
      setError(null);
      show(`${chosen.length} ${chosen.length === 1 ? "set" : "sets"} archived.`);
      setPicked(new Set());
      router.refresh();
    });
  };

  if (sets.length === 0) {
    return (
      <>
        {/* Пустая категория — начало, а не поломка, и пустое место здесь
            ничего не объясняет. Действие стоит прямо в нём. */}
        <div className="mt-3 rounded-xl border border-dashed border-line px-5 py-12 text-center">
          <p className="font-semibold">No sets yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            A set is a collection of cards you study together. Create one — it can
            sit empty until you have cards for it.
          </p>
          <div className="mt-4 flex justify-center">
            <NewSetButton categoryId={categoryId} categoryPath={categoryPath} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {menu.menu}
      {dialog}
      {toast}
      {menu.notice}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}

      {/* Панель появляется по выбору и исчезает вместе с ним: постоянная
          полоса действий над списком отнимала бы место у самого списка. */}
      {picked.size > 0 && (
        <div className={`${panelClass} mt-3 flex flex-wrap items-center gap-2 p-2`}>
          <span className="px-2 text-sm font-semibold tabular-nums">
            {picked.size} {picked.size === 1 ? "set" : "sets"} selected
            <span className="ml-2 font-normal text-muted">
              {cards} {cards === 1 ? "card" : "cards"}
            </span>
          </span>
          <Button size="sm" tone="danger" onClick={removeChosen}>
            Delete {picked.size === 1 ? "set" : "sets"}
          </Button>
          <Button size="sm" onClick={archiveChosen}>
            Archive
          </Button>
          <Button size="sm" tone="ghost" onClick={() => setPicked(new Set())}>
            Cancel selection
          </Button>
        </div>
      )}

      <ul
        className={`mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
          busy || menu.busy ? "opacity-60" : ""
        }`}
      >
        {sets.map((deck) => (
          <li key={deck.id}>
            <DeckCard
              deck={deck}
              selecting
              selected={picked.has(deck.id)}
              onToggle={() => toggle(deck.id)}
              onOpenMenu={(at) => menu.open(deck, at)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
