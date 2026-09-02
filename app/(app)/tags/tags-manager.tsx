"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteTagEverywhere, renameTagEverywhere } from "@/app/(app)/decks/[id]/actions";
import { setTagColor } from "./actions";
import { hueClass, slotName, TAG_SLOTS, type TagSlot } from "@/lib/tag-color";
import { SearchIcon, TrashIcon } from "@/components/icons";
import { useConfirm } from "@/components/ui/confirm";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { TagChip } from "@/components/ui/tag-chip";

export type TagRowView = { id: string; name: string; count: number; slot: TagSlot };

export function TagsManager({ tags }: { tags: TagRowView[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { ask, dialog } = useConfirm();

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

  const paint = (tagId: string, slot: TagSlot) => {
    startTransition(async () => {
      const res = await setTagColor(tagId, slot);
      if (!res.ok) setError(res.error ?? "Could not set the colour");
      else {
        setError(null);
        router.refresh();
      }
    });
  };

  const drop = async (name: string, count: number) => {
    const confirmed = await ask({
      title: `Delete the tag “${name}”?`,
      description: `It is removed from ${count} ${count === 1 ? "card" : "cards"}. The cards themselves stay.`,
      confirmLabel: "Delete tag",
    });
    if (!confirmed) return;
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
      {dialog}
      <div className="relative max-w-md">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tags…"
          aria-label="Filter tags"
          className={`${inputClass} pl-11`}
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
            <li key={tag.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <TagChip name={tag.name} slot={tag.slot} href={`/library?tag=${tag.id}`} />
              <span className="tabular-nums text-xs text-faint">
                {tag.count} {tag.count === 1 ? "card" : "cards"}
              </span>
              <Palette current={tag.slot} onPick={(slot) => paint(tag.id, slot)} />
              <Button size="sm" onClick={() => rename(tag.name)} className="ml-auto">
                Rename
              </Button>
              <Button
                tone="ghost"
                size="icon"
                onClick={() => drop(tag.name, tag.count)}
                aria-label={`Delete tag ${tag.name}`}
                className="hover:text-rust"
              >
                <TrashIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Выбор цвета: шесть проверенных оттенков плюс «без цвета».
 *
 * Группа радиокнопок, а не набор самостоятельных кнопок: выбор здесь
 * взаимоисключающий, и стрелки внутри группы должны работать сами — это
 * поведение даёт разметка, а не обработчики.
 */
function Palette({
  current,
  onPick,
}: {
  current: TagSlot;
  onPick: (slot: TagSlot) => void;
}) {
  const options: TagSlot[] = [...Array(TAG_SLOTS).keys(), null];

  return (
    <div role="radiogroup" aria-label="Tag colour" className="flex items-center gap-1">
      {options.map((slot) => {
        const active = slot === current;
        const hue = hueClass(slot);
        return (
          <button
            key={slot ?? "none"}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={slotName(slot)}
            title={slotName(slot)}
            onClick={() => onPick(slot)}
            className={`grid size-7 place-items-center rounded-full transition-[box-shadow] ${
              active ? "shadow-[0_0_0_2px_var(--accent)]" : "hover:shadow-[0_0_0_2px_var(--line-strong)]"
            }`}
          >
            <span
              aria-hidden
              className={`size-3.5 rounded-full ${hue || "border-control border-field-line"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
