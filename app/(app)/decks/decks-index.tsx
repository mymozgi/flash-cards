"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createTopic, deleteTopic } from "@/app/(app)/topics/actions";
import { CheckIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { DeckCard, type DeckSummary } from "@/components/deck-card";
import { useConfirm } from "@/components/ui/confirm";
import { inputClass, selectClass } from "@/components/ui/field";

const SORTS = [
  { key: "recent", label: "Last used" },
  { key: "name", label: "Name" },
  { key: "size", label: "Cards" },
  { key: "progress", label: "Progress" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

export function DecksIndex({
  decks,
  dueCount,
  openCreate,
  readOnly = false,
}: {
  decks: DeckSummary[];
  dueCount: number;
  openCreate: boolean;
  /** Гостевой режим: всё, что меняет данные, не показываем вовсе. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(openCreate);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? decks.filter((d) =>
          [d.name, d.description, d.category ?? ""].some((f) => f.toLowerCase().includes(q)),
        )
      : decks;

    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return b.total - a.total;
      if (sort === "progress") {
        const ratio = (d: DeckSummary) => (d.total === 0 ? 0 : d.memorized / d.total);
        return ratio(b) - ratio(a);
      }
      return (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "");
    });
  }, [decks, query, sort]);

  const totalCards = decks.reduce((sum, d) => sum + d.total, 0);
  const unmemorized = decks.reduce((sum, d) => sum + (d.total - d.memorized), 0);

  const create = () => {
    const form = new FormData();
    form.set("path", name);
    startTransition(async () => {
      const res = await createTopic({ error: null }, form);
      if (res.error) {
        setError(res.error);
        return;
      }
      setName("");
      setCreating(false);
      setError(null);
      router.refresh();
    });
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const confirmed = await ask({
      title: `Delete ${ids.length} ${ids.length === 1 ? "set" : "sets"}?`,
      description:
        "The cards are not deleted — they move up to the parent category and stay searchable in the library.",
      confirmLabel: "Delete sets",
    });
    if (!confirmed) return;
    startTransition(async () => {
      for (const id of ids) {
        const res = await deleteTopic(id, "reparent");
        if (res.error) {
          setError(res.error);
          return;
        }
      }
      setSelected(new Set());
      setSelecting(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My flashcard sets</h1>
        {!readOnly && (
          <Button tone="primary" onClick={() => setCreating((c) => !c)}>
            <PlusIcon />
            Create set
          </Button>
        )}
      </div>

      {creating && (
        <div className={`${panelClass} flex flex-wrap items-center gap-2 p-3`}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Set name, or Category / Set to nest it"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <Button tone="primary" onClick={create} loading={busy}>
            Create
          </Button>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            aria-label="Search sets"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className={`${selectClass} w-auto`}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setSelecting((v) => !v);
              setSelected(new Set());
            }}
            aria-pressed={selecting}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              selecting ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
            }`}
          >
            <CheckIcon className="size-3.5" />
            Select
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}

      {selecting && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="tabular-nums text-muted">{selected.size} selected</span>
          <button type="button" onClick={removeSelected} className="ml-auto text-rust">
            Delete
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface py-16 text-center text-sm text-muted">
          {decks.length > 0
            ? "Nothing matches the search."
            : readOnly
              ? "This library has nothing to show yet."
              : "No sets yet — create the first one."}
        </p>
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
          {visible.map((deck) => (
            <li key={deck.id}>
              <DeckCard
                deck={deck}
                readOnly={readOnly}
                selecting={selecting}
                selected={selected.has(deck.id)}
                onToggle={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(deck.id)) next.delete(deck.id);
                    else next.add(deck.id);
                    return next;
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {/* липкая панель действий: на телефоне поднята над безопасной зоной */}
      {!readOnly && (
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:mt-4 lg:rounded-xl lg:border lg:px-4 lg:pb-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Link
            href="/review?free=1"
            className="flex-1 rounded-lg border border-line px-4 py-2.5 text-center text-sm"
          >
            Study all <span className="tabular-nums text-faint">{totalCards}</span>
          </Link>
          <Link
            href="/review"
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-ink"
          >
            Review due <span className="tabular-nums opacity-80">{dueCount}</span>
          </Link>
          <span className="hidden text-sm text-faint sm:block">
            {unmemorized} not memorized yet
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
