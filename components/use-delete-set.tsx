"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { removeSet } from "@/app/(app)/knowledge/actions";
import type { DeckSummary } from "@/lib/types";

/**
 * Удаление набора: подтверждение, действие, сообщение об исходе.
 *
 * Один хук на все экраны, где показывается плитка набора. Текст
 * подтверждения — часть правила, а не оформление: он обещает, что именно
 * произойдёт с карточками, и разойдись он между экранами, на одном из них
 * обещание стало бы ложным.
 */
export function useDeleteSet() {
  const { ask, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const remove = async (deck: Pick<DeckSummary, "id" | "name" | "total">) => {
    /*
      Подтверждение называет объём и цену. Удаление здесь необратимо: в
      отличие от корзины, куда попадает карточка, удалённая поодиночке, тут
      уходит и сама карточка, и её история повторений.

      Поэтому в тексте есть и число, и слово «permanently», и отдельная
      строка про невозвратность. «Delete?» без них скрывает ровно то, о чём
      спрашивает, а цена тут выше обычной.
    */
    const confirmed = await ask({
      title: "Delete set?",
      description:
        deck.total === 0
          ? `“${deck.name}” contains no flashcards. The set is removed for good.`
          : `“${deck.name}” contains ${deck.total} ${
              deck.total === 1 ? "flashcard" : "flashcards"
            }. Deleting the set permanently deletes every card inside it, along with their review history. This cannot be undone.`,
      confirmLabel: "Delete set",
      tone: "danger",
    });
    if (!confirmed) return;

    startTransition(async () => {
      const res = await removeSet(deck.id);
      if (!res.ok) {
        setError(res.error ?? "Could not delete the set");
        return;
      }
      setError(null);
      show(`“${deck.name}” was deleted.`);
      /*
        Счётчики пересчитывает сервер. Править число на месте значило бы
        завести вторую арифметику рядом с первой, и они разошлись бы на
        первом же случае, которого вторая не знает.
      */
      router.refresh();
    });
  };

  const notice = error ? (
    <p role="alert" className="mt-3 rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
      {error}
    </p>
  ) : null;

  return { remove, dialog, toast, notice, busy };
}
