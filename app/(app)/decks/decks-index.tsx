"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createTopic, deleteTopic } from "@/app/(app)/topics/actions";
import { CheckIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";

export type DeckSummary = {
  id: string;
  name: string;
  description: string;
  color: string;
  category: string | null;
  total: number;
  memorized: number;
  lastUsed: string | null;
};

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
}: {
  decks: DeckSummary[];
  dueCount: number;
  openCreate: boolean;
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

  const removeSelected = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} set(s)? Cards move up to the parent category.`)) return;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My flashcard sets</h1>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
        >
          <PlusIcon />
          Create set
        </button>
      </div>

      {creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 shadow-sm">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Set name, or Category / Set to nest it"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-sm focus:border-line focus:bg-surface"
          />
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60"
          >
            Create
          </button>
          <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-line px-4 py-2 text-sm">
            Cancel
          </button>
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
            className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
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
          {decks.length === 0 ? "No sets yet — create the first one." : "Nothing matches the search."}
        </p>
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
          {visible.map((deck) => (
            <li key={deck.id}>
              <DeckCard
                deck={deck}
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
    </div>
  );
}

function DeckCard({
  deck,
  selecting,
  selected,
  onToggle,
}: {
  deck: DeckSummary;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const ratio = deck.total === 0 ? 0 : Math.round((deck.memorized / deck.total) * 100);

  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-surface p-4 shadow-sm ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs"
          style={{
            background: deck.color ? `${deck.color}22` : "var(--surface-2)",
            color: deck.color || "var(--muted)",
          }}
        >
          {deck.category ?? "No category"}
        </span>
        {selecting ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${deck.name}`}
            className="size-4 accent-[var(--accent)]"
          />
        ) : (
          <Link
            href={`/decks/${deck.id}`}
            aria-label={`Edit ${deck.name}`}
            className="text-faint hover:text-ink"
          >
            <TrashIcon className="size-4 opacity-0" />
          </Link>
        )}
      </div>

      <Link href={`/decks/${deck.id}`} className="mt-3 block">
        <h2 className="text-lg font-semibold leading-tight">{deck.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {deck.description || "No description"}
        </p>
      </Link>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-xs">
          <span className="uppercase tracking-wide text-faint">Cards memorized</span>
          <span className="tabular-nums text-muted">
            {deck.memorized}/{deck.total}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${ratio}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span>
          {deck.total} {deck.total === 1 ? "card" : "cards"}
        </span>
        <span>
          {deck.lastUsed
            ? `Last used ${new Date(deck.lastUsed).toLocaleDateString()}`
            : "Not studied yet"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          href={`/decks/${deck.id}/study`}
          className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-sm"
        >
          Study
        </Link>
        <Link
          href={`/decks/${deck.id}`}
          className="flex-1 rounded-lg bg-accent-soft px-3 py-2 text-center text-sm font-medium text-accent"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
