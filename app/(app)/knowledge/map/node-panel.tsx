"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { GraphNode } from "@/lib/knowledge-graph";
import { Button, LinkButton } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { attachCards, attachedCards, detachCard, searchCards } from "./actions";

type CardHit = { id: string; front: string };

/**
 * Панель выбранного узла.
 *
 * Здесь и живёт то, ради чего карта затевалась: прикрепление пачки карточек к
 * категории. Именно прикрепление, а не перенос — главное место карточки
 * остаётся прежним, и одно знание честно относится к нескольким областям без
 * копий. Копия дала бы две истории повторений одного знания.
 *
 * Панель, а не отдельная страница: выбирая карточки, надо видеть, к чему их
 * прикрепляешь, а уход со страницы это как раз и отнимает.
 */
export function NodePanel({
  node,
  attachReady,
  onClose,
}: {
  node: GraphNode;
  attachReady: boolean;
  onClose: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CardHit[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [attached, setAttached] = useState<CardHit[] | null>(null);
  const [adding, setAdding] = useState(false);

  /*
    Сброс состояния при смене узла делает не эффект, а ключ на компоненте в
    родителе: панель просто пересоздаётся. Эффект, который синхронно
    расставляет пять setState, — это тот же ремонт, только вручную и с лишним
    проходом отрисовки.
  */
  useEffect(() => {
    if (!attachReady) return;
    let alive = true;
    void (async () => {
      const list = await attachedCards(node.id);
      if (alive) setAttached(list);
    })();
    return () => {
      alive = false;
    };
  }, [attachReady, node.id]);

  const find = () => {
    startTransition(async () => setHits(await searchCards(node.id, query)));
  };

  const attach = () => {
    const ids = [...picked];
    startTransition(async () => {
      const res = await attachCards(node.id, ids);
      if (!res.ok) {
        setError(res.error ?? "Could not attach the cards");
        return;
      }
      setError(null);
      setPicked(new Set());
      setHits([]);
      setQuery("");
      setAdding(false);
      setAttached(await attachedCards(node.id));
    });
  };

  const detach = (cardId: string) => {
    startTransition(async () => {
      const res = await detachCard(node.id, cardId);
      if (!res.ok) {
        setError(res.error ?? "Could not detach the card");
        return;
      }
      setError(null);
      setAttached(await attachedCards(node.id));
    });
  };

  return (
    <aside
      aria-label={`Details for ${node.name}`}
      className="absolute inset-y-0 right-0 z-20 flex w-[min(22rem,100%)] flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-4 shadow-overlay"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg text-lg"
          style={{
            background: `color-mix(in srgb, ${node.color || "var(--accent)"} 18%, var(--surface))`,
          }}
        >
          {node.icon || node.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-tight">{node.name}</h2>
          <p className="label-micro mt-1">
            {node.cards} cards · {node.children} sub
            {node.attached > 0 && ` · +${node.attached} attached`}
          </p>
        </div>
        <Button size="icon" onClick={onClose} aria-label="Close" title="Close">
          <CloseIcon />
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/knowledge/${node.id}`} size="sm" tone="soft">
          Open
        </LinkButton>
        <LinkButton href={`/decks/${node.id}`} size="sm">
          Edit cards
        </LinkButton>
        <LinkButton href={`/review?free=1&topic=${node.id}`} size="sm">
          Practice
        </LinkButton>
      </div>

      <section className="border-t border-line pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="label-micro">Attached cards</h3>
          {attachReady && !adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              Attach…
            </Button>
          )}
        </div>

        {!attachReady ? (
          <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-2xs text-amber">
            Attaching cards needs <code>supabase/migrations/0019_card_topics.sql</code>. The rest of
            the map works without it.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-2xs text-faint">
              A card attached here keeps its main category. Nothing is copied — the same card simply
              belongs in two places.
            </p>

            {adding && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
                    <SearchIcon />
                  </span>
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && find()}
                    placeholder="Search cards by question…"
                    aria-label="Search cards to attach"
                    className={`${inputClass} pl-11`}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={find} loading={busy}>
                    Find
                  </Button>
                  <Button
                    size="sm"
                    tone="primary"
                    onClick={attach}
                    disabled={picked.size === 0}
                    loading={busy}
                  >
                    Attach {picked.size > 0 ? picked.size : ""}
                  </Button>
                  <Button size="sm" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>

                {hits.length > 0 && (
                  <ul className="max-h-56 overflow-y-auto rounded-lg border border-line">
                    {hits.map((hit) => {
                      const on = picked.has(hit.id);
                      return (
                        <li key={hit.id} className="border-b border-line last:border-b-0">
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setPicked((prev) => {
                                const next = new Set(prev);
                                if (next.has(hit.id)) next.delete(hit.id);
                                else next.add(hit.id);
                                return next;
                              })
                            }
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                              on ? "bg-accent-soft text-accent" : "hover:bg-surface-2"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`grid size-4 shrink-0 place-items-center rounded border-control text-2xs ${
                                on ? "border-accent bg-accent text-accent-ink" : "border-field-line"
                              }`}
                            >
                              {on ? "✓" : ""}
                            </span>
                            <span className="truncate">{hit.front}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {attached === null ? (
              <p className="mt-3 text-sm text-muted">Loading…</p>
            ) : attached.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nothing attached here yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1.5">
                {attached.map((card) => (
                  <li
                    key={card.id}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{card.front}</span>
                    <button
                      type="button"
                      onClick={() => detach(card.id)}
                      aria-label={`Detach ${card.front}`}
                      title="Detach — the card keeps its main category"
                      className="shrink-0 text-faint hover:text-rust"
                    >
                      <CloseIcon className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <p className="mt-auto text-2xs text-faint">
        Drag a node to move it. Everything else lives in{" "}
        <Link href="/knowledge" className="text-accent underline underline-offset-4">
          Tree
        </Link>
        .
      </p>
    </aside>
  );
}
