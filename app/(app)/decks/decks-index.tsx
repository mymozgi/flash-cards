"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createTopic, deleteTopic } from "@/app/(app)/topics/actions";
import { CheckIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/button";
import { panelClass } from "@/components/ui/panel";
import { DeckCard, type DeckSummary } from "@/components/deck-card";
import { useConfirm } from "@/components/ui/confirm";
import { useDeleteSet } from "@/components/use-delete-set";
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
  /** null — «все категории». Иначе id узла, чью ветку показываем. */
  const [branch, setBranch] = useState<string | null>(null);
  const [onlyUnfinished, setOnlyUnfinished] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(openCreate);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();
  /* Тот же хук, что и на экране категории: удаление, доступное только с
     одного экрана, на телефоне равно отсутствующему — эту беду в проекте
     уже проходили с удалением категории. */
  const deleteSet = useDeleteSet();

  /**
   * Категории для фильтра — корни, у которых действительно что-то есть.
   * Показывать пустую ветку значило бы предлагать фильтр, который заведомо
   * даёт пустой экран.
   */
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string; count: number }>();
    for (const deck of decks) {
      const entry = seen.get(deck.rootId) ?? {
        id: deck.rootId,
        name: deck.rootName,
        color: deck.rootColor,
        count: 0,
      };
      entry.count += 1;
      seen.set(deck.rootId, entry);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [decks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = decks;

    // Ветка целиком, а не только прямые дети: выбрав «Psychology», человек
    // ждёт увидеть и то, что лежит под «Cognitive Biases»
    if (branch) {
      list = list.filter((d) => d.id === branch || d.ancestors.includes(branch));
    }
    if (onlyUnfinished) {
      list = list.filter((d) => d.total > d.memorized);
    }
    if (q) {
      list = list.filter((d) =>
        [d.name, d.description, d.category ?? ""].some((f) => f.toLowerCase().includes(q)),
      );
    }

    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return b.total - a.total;
      if (sort === "progress") {
        const ratio = (d: DeckSummary) => (d.total === 0 ? 0 : d.memorized / d.total);
        return ratio(b) - ratio(a);
      }
      return (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "");
    });
  }, [decks, query, sort, branch, onlyUnfinished]);

  const totalCards = visible.reduce((sum, d) => sum + d.total, 0);
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
      {deleteSet.dialog}
      {deleteSet.toast}
      {deleteSet.notice}
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
            placeholder="Topic name, or Category / Topic to file it"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <Button tone="primary" onClick={create} loading={busy}>
            Create
          </Button>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      {/* Фильтры отдельной полосой над поиском: они сужают набор, а поиск и
          сортировка работают уже внутри суженного. Смешивать их в одну строку
          значило бы делать вид, что это равноправные элементы. */}
      {categories.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterChip active={branch === null} onClick={() => setBranch(null)}>
            All
            <span className="tabular-nums opacity-60">{decks.length}</span>
          </FilterChip>
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              active={branch === category.id}
              color={category.color}
              onClick={() => setBranch((prev) => (prev === category.id ? null : category.id))}
            >
              {category.name}
              <span className="tabular-nums opacity-60">{category.count}</span>
            </FilterChip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            aria-label="Search sets"
            className={`${inputClass} pl-11`}
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
        <button
          type="button"
          onClick={() => setOnlyUnfinished((v) => !v)}
          aria-pressed={onlyUnfinished}
          title="Hide sets where every card is already memorized"
          className={`flex min-h-12 items-center gap-2 rounded-lg border-control px-4 text-sm font-semibold ${
            onlyUnfinished
              ? "border-accent bg-accent-soft text-accent"
              : "border-field-line text-muted"
          }`}
        >
          Unfinished
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              setSelecting((v) => !v);
              setSelected(new Set());
            }}
            aria-pressed={selecting}
            className={`flex min-h-12 items-center gap-2 rounded-lg border-control px-4 text-sm font-semibold ${
              selecting
                ? "border-accent bg-accent-soft text-accent"
                : "border-field-line text-muted"
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
          {decks.length > 0 ? (
            <>
              Nothing matches these filters.{" "}
              <button
                type="button"
                onClick={() => {
                  setBranch(null);
                  setOnlyUnfinished(false);
                  setQuery("");
                }}
                className="text-accent underline underline-offset-4"
              >
                Clear them
              </button>
            </>
          ) : readOnly ? (
            "This library has nothing to show yet."
          ) : (
            "No sets yet — create the first one."
          )}
        </p>
      ) : (
        <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${busy ? "opacity-60" : ""}`}>
          {visible.map((deck) => (
            <li key={deck.id}>
              <DeckCard
                deck={deck}
                readOnly={readOnly}
                onDelete={selecting ? undefined : () => deleteSet.remove(deck)}
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
          <LinkButton href="/review?free=1" className="flex-1">
            Study all <span className="tabular-nums text-faint">{totalCards}</span>
          </LinkButton>
          <LinkButton href="/review" tone="primary" className="flex-1">
            Review due <span className="tabular-nums opacity-80">{dueCount}</span>
          </LinkButton>
          <span className="hidden text-sm text-faint sm:block">
            {unmemorized} not memorized yet
          </span>
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Пилюля фильтра.
 *
 * Цвет категории показан точкой, а не заливкой: заливка чужим цветом сломала
 * бы контраст подписи, а сам оттенок здесь второй признак — имя категории
 * видно всегда. Тот же приём, что у пилюль тегов.
 */
function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border-control px-4 text-sm font-semibold ${
        active ? "border-accent bg-accent-soft text-accent" : "border-field-line text-muted"
      }`}
    >
      {color && (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      {children}
    </button>
  );
}
