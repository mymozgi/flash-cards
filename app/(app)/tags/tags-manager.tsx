"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteTagEverywhere, renameTagEverywhere } from "@/app/(app)/decks/[id]/actions";
import { SearchIcon, TrashIcon } from "@/components/icons";

export type TagRowView = { id: string; name: string; count: number };

export function TagsManager({ tags }: { tags: TagRowView[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.includes(q)) : tags;
  }, [tags, query]);

  const rename = (name: string) => {
    const next = prompt(`Rename “${name}” everywhere it is used:`, name);
    if (!next || next === name) return;
    startTransition(async () => {
      const res = await renameTagEverywhere(name, next);
      if (!res.ok) setError(res.error ?? "Could not rename the tag");
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const drop = (name: string, count: number) => {
    if (!confirm(`Remove “${name}” from ${count} card(s)? The cards stay.`)) return;
    startTransition(async () => {
      const res = await deleteTagEverywhere(name);
      if (!res.ok) setError(res.error ?? "Could not delete the tag");
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-5">
      <div className="relative max-w-md">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tags…"
          aria-label="Filter tags"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {tags.length === 0 ? "No tags yet." : "Nothing matches the filter."}
        </p>
      ) : (
        <ul className={`mt-4 divide-y divide-line rounded-xl border border-line bg-surface ${busy ? "opacity-60" : ""}`}>
          {visible.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Link
                href={`/library?tag=${tag.id}`}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent"
              >
                {tag.name}
              </Link>
              <span className="tabular-nums text-xs text-faint">
                {tag.count} {tag.count === 1 ? "card" : "cards"}
              </span>
              <button
                type="button"
                onClick={() => rename(tag.name)}
                className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => drop(tag.name, tag.count)}
                aria-label={`Delete tag ${tag.name}`}
                className="p-1.5 text-faint hover:text-rust"
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
