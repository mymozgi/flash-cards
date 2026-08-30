"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { removeCard, saveDeck, updateDeck, type DeckCardInput } from "./actions";

const OPTION_SLOTS = 5;
const VIEWS = [
  { key: "list", label: "List" },
  { key: "grid", label: "Grid" },
  { key: "sheet", label: "Spreadsheet" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const COLUMNS = [
  { key: "term", label: "Term" },
  { key: "definition", label: "Definition" },
  { key: "example", label: "Example (optional)" },
  { key: "link", label: "Link" },
  { key: "tags", label: "Tags" },
  { key: "answers", label: "Answers" },
] as const;
type Column = (typeof COLUMNS)[number]["key"];

export type Deck = {
  id: string;
  name: string;
  description: string;
  color: string;
  parentName: string | null;
};

export function DeckWorkspace({
  deck,
  initialCards,
}: {
  deck: Deck;
  initialCards: DeckCardInput[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [columns, setColumns] = useState<Set<Column>>(new Set(COLUMNS.map((c) => c.key)));
  const [status, setStatus] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Deck | null>(null);

  const touch = (id: string) => setDirty((prev) => new Set(prev).add(id));

  const update = (id: string, patch: Partial<DeckCardInput>) => {
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
    touch(id);
  };

  const setOption = (card: DeckCardInput, index: number, value: string) =>
    update(card.id, {
      options: card.options.map((option, i) => (i === index ? value : option)),
    });

  const addCard = () => {
    const card: DeckCardInput = {
      id: crypto.randomUUID(),
      isNew: true,
      term: "",
      options: Array(OPTION_SLOTS).fill(""),
      correctIndex: 0,
      example: "",
      link: "",
      mcq: false,
      tags: "",
    };
    setCards((prev) => [...prev, card]);
    touch(card.id);
  };

  const drop = async (card: DeckCardInput) => {
    if (!card.isNew && !confirm(`Delete “${card.term || "untitled card"}”?`)) return;
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(card.id);
      return next;
    });
    if (!card.isNew) {
      const res = await removeCard(card.id);
      if (!res.ok) setStatus({ kind: "error", text: res.error ?? "Could not delete the card" });
    }
  };

  const save = async () => {
    const pending = cards.filter((card) => dirty.has(card.id));
    if (pending.length === 0) {
      setStatus({ kind: "ok", text: "Nothing to save" });
      return;
    }
    setSaving(true);
    setStatus(null);

    const res = await saveDeck(deck.id, pending);
    setSaving(false);

    if (!res.ok) {
      setStatus({ kind: "error", text: res.error ?? "Could not save" });
      return;
    }
    setCards((prev) => prev.map((card) => ({ ...card, isNew: false })));
    setDirty(new Set());
    setStatus({ kind: "ok", text: `Saved ${res.saved} card${res.saved === 1 ? "" : "s"}` });
    router.refresh();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) =>
      [card.term, card.example, card.tags, ...card.options].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [cards, query]);

  return (
    <div className="flex flex-col gap-4">
      <DeckHeader
        deck={deck}
        count={cards.length}
        editing={details}
        onEdit={() => setDetails(deck)}
        onCancel={() => setDetails(null)}
        onChange={(patch) => setDetails((d) => (d ? { ...d, ...patch } : d))}
        onSave={async () => {
          if (!details) return;
          const res = await updateDeck(deck.id, {
            name: details.name,
            description: details.description,
            color: details.color,
          });
          if (!res.ok) {
            setStatus({ kind: "error", text: res.error ?? "Could not save the deck" });
            return;
          }
          setDetails(null);
          router.refresh();
        }}
      />

      <div className="flex flex-wrap items-center gap-2 rounded border border-line bg-surface p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards…"
          className="min-w-0 flex-1 rounded border border-line bg-paper px-3 py-2 text-sm"
        />
        <div className="flex overflow-hidden rounded border border-line">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              aria-pressed={view === item.key}
              className={`px-3 py-2 text-sm ${
                view === item.key ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          {saving ? "Saving…" : dirty.size > 0 ? `Save ${dirty.size} card${dirty.size === 1 ? "" : "s"}` : "Save cards"}
        </button>
      </div>

      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`rounded border-l-[3px] px-3 py-2 text-sm ${
            status.kind === "error" ? "border-rust bg-rust-soft" : "border-accent bg-accent-soft"
          }`}
        >
          {status.text}
        </p>
      )}

      <section className="rounded border border-line bg-surface p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Flashcards</h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-faint">
            {visible.length} of {cards.length}
          </span>
        </div>

        {view === "sheet" ? (
          <Spreadsheet
            cards={visible}
            columns={columns}
            onToggleColumn={(key) =>
              setColumns((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              })
            }
            onUpdate={update}
            onOption={setOption}
            onDelete={drop}
          />
        ) : (
          <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>
            {visible.map((card) => (
              <CardBlock
                key={card.id}
                card={card}
                index={cards.indexOf(card) + 1}
                compact={view === "grid"}
                onUpdate={update}
                onOption={setOption}
                onDelete={drop}
              />
            ))}
          </div>
        )}

        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {cards.length === 0 ? "This deck is empty." : "No cards match the search."}
          </p>
        )}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={addCard}
            className="rounded bg-accent px-6 py-3 text-sm font-medium text-accent-ink"
          >
            + Add card
          </button>
        </div>
      </section>
    </div>
  );
}

function DeckHeader({
  deck,
  count,
  editing,
  onEdit,
  onCancel,
  onChange,
  onSave,
}: {
  deck: Deck;
  count: number;
  editing: Deck | null;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (patch: Partial<Deck>) => void;
  onSave: () => void;
}) {
  return (
    <header className="rounded border border-line bg-surface p-4 sm:p-5">
      {editing ? (
        <div className="flex flex-col gap-3">
          <input
            value={editing.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="rounded border border-line bg-paper px-3 py-2 font-display text-2xl font-semibold"
          />
          <textarea
            value={editing.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="What is this deck about?"
            className="rounded border border-line bg-paper px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Colour
            <input
              type="color"
              value={editing.color || "#0e6e5b"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-14 rounded border border-line bg-paper"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
              Save details
            </button>
            <button type="button" onClick={onCancel} className="rounded border border-line px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ background: deck.color || "var(--accent)" }}
              />
              <h1 className="font-display text-3xl font-semibold tracking-tight">{deck.name}</h1>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
            >
              Edit details
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full border border-line px-2.5 py-0.5 text-muted">
              {count} {count === 1 ? "card" : "cards"}
            </span>
            {deck.parentName && (
              <span className="rounded-full border border-line px-2.5 py-0.5 text-muted">
                {deck.parentName}
              </span>
            )}
          </div>
          {deck.description && <p className="mt-3 text-sm text-muted">{deck.description}</p>}
        </>
      )}
    </header>
  );
}

function CardBlock({
  card,
  index,
  compact,
  onUpdate,
  onOption,
  onDelete,
}: {
  card: DeckCardInput;
  index: number;
  compact: boolean;
  onUpdate: (id: string, patch: Partial<DeckCardInput>) => void;
  onOption: (card: DeckCardInput, index: number, value: string) => void;
  onDelete: (card: DeckCardInput) => void;
}) {
  return (
    <article className="rounded border border-line bg-paper p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-faint">#{index}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className={compact ? "text-xs" : ""}>Multiple choice</span>
            <input
              type="checkbox"
              role="switch"
              checked={card.mcq}
              onChange={(e) => onUpdate(card.id, { mcq: e.target.checked })}
              className="size-4 accent-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            onClick={() => onDelete(card)}
            aria-label="Delete card"
            className="text-faint hover:text-rust"
          >
            ✕
          </button>
        </div>
      </div>

      <Label>Question</Label>
      <textarea
        value={card.term}
        onChange={(e) => onUpdate(card.id, { term: e.target.value })}
        rows={compact ? 2 : 3}
        className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm"
      />

      {card.mcq ? (
        <>
          <div className="mt-3 flex items-baseline justify-between">
            <Label inline>Answer options</Label>
            <span className="text-xs text-faint">Select the correct answer</span>
          </div>
          <ul className="mt-1 flex flex-col gap-2 border-l-2 border-accent-soft pl-3">
            {card.options.map((option, i) => (
              <li key={i} className="flex items-start gap-2">
                <input
                  type="radio"
                  name={`correct-${card.id}`}
                  checked={card.correctIndex === i}
                  onChange={() => onUpdate(card.id, { correctIndex: i })}
                  aria-label={`Mark answer ${i + 1} as correct`}
                  className="mt-2 size-4 shrink-0 accent-[var(--accent)]"
                />
                <textarea
                  value={option}
                  onChange={(e) => onOption(card, i, e.target.value)}
                  placeholder={`Answer ${i + 1}`}
                  rows={compact ? 2 : 2}
                  className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm"
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <Label>Answer</Label>
          <textarea
            value={card.options[card.correctIndex] ?? ""}
            onChange={(e) => onOption(card, card.correctIndex, e.target.value)}
            rows={compact ? 2 : 3}
            className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </>
      )}

      <div className={`mt-3 grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        <div>
          <Label>Example — optional</Label>
          <input
            value={card.example}
            onChange={(e) => onUpdate(card.id, { example: e.target.value })}
            placeholder="Example…"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label>Link</Label>
          <input
            value={card.link}
            onChange={(e) => onUpdate(card.id, { link: e.target.value })}
            placeholder="https://…"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      <Label>Tags</Label>
      <input
        value={card.tags}
        onChange={(e) => onUpdate(card.id, { tags: e.target.value })}
        placeholder="vocabulary, interview-prep"
        className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
      />
    </article>
  );
}

function Spreadsheet({
  cards,
  columns,
  onToggleColumn,
  onUpdate,
  onOption,
  onDelete,
}: {
  cards: DeckCardInput[];
  columns: Set<Column>;
  onToggleColumn: (key: Column) => void;
  onUpdate: (id: string, patch: Partial<DeckCardInput>) => void;
  onOption: (card: DeckCardInput, index: number, value: string) => void;
  onDelete: (card: DeckCardInput) => void;
}) {
  const cell = "border-b border-line px-2 py-2 align-top";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.13em] text-faint">
          View options
        </span>
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            onClick={() => onToggleColumn(column.key)}
            aria-pressed={columns.has(column.key)}
            className={`rounded-full px-3 py-1 text-xs ${
              columns.has(column.key)
                ? "bg-accent text-accent-ink"
                : "border border-line text-muted hover:text-ink"
            }`}
          >
            {column.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-surface-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {COLUMNS.filter((c) => columns.has(c.key)).map((column) => (
                <th key={column.key} className="px-2 py-2 font-medium">
                  {column.label}
                </th>
              ))}
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                {columns.has("term") && (
                  <td className={`${cell} w-40`}>
                    <textarea
                      value={card.term}
                      onChange={(e) => onUpdate(card.id, { term: e.target.value })}
                      rows={2}
                      className="w-full resize-y rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-line focus:bg-surface"
                    />
                  </td>
                )}
                {columns.has("definition") && (
                  <td className={cell}>
                    <textarea
                      value={card.options[card.correctIndex] ?? ""}
                      onChange={(e) => onOption(card, card.correctIndex, e.target.value)}
                      rows={2}
                      className="w-full resize-y rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-line focus:bg-surface"
                    />
                  </td>
                )}
                {columns.has("example") && (
                  <td className={`${cell} w-40`}>
                    <input
                      value={card.example}
                      onChange={(e) => onUpdate(card.id, { example: e.target.value })}
                      placeholder="Example…"
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-line focus:bg-surface"
                    />
                  </td>
                )}
                {columns.has("link") && (
                  <td className={`${cell} w-36`}>
                    <input
                      value={card.link}
                      onChange={(e) => onUpdate(card.id, { link: e.target.value })}
                      placeholder="https://…"
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-line focus:bg-surface"
                    />
                  </td>
                )}
                {columns.has("tags") && (
                  <td className={`${cell} w-32`}>
                    <input
                      value={card.tags}
                      onChange={(e) => onUpdate(card.id, { tags: e.target.value })}
                      placeholder="+ tag"
                      className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-line focus:bg-surface"
                    />
                  </td>
                )}
                {columns.has("answers") && (
                  <td className={`${cell} w-64`}>
                    <ul className="flex flex-col gap-1">
                      {card.options.map((option, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            name={`sheet-correct-${card.id}`}
                            checked={card.correctIndex === i}
                            onChange={() => onUpdate(card.id, { correctIndex: i })}
                            aria-label={`Mark option ${i + 1} as correct`}
                            className="size-3.5 shrink-0 accent-[var(--accent)]"
                          />
                          <input
                            value={option}
                            onChange={(e) => onOption(card, i, e.target.value)}
                            placeholder={`Option ${i + 1}`}
                            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs focus:border-line focus:bg-surface"
                          />
                          <button
                            type="button"
                            onClick={() => onOption(card, i, "")}
                            aria-label={`Clear option ${i + 1}`}
                            className="shrink-0 text-faint hover:text-rust"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </td>
                )}
                <td className={`${cell} text-right`}>
                  <button
                    type="button"
                    onClick={() => onDelete(card)}
                    aria-label="Delete card"
                    className="text-faint hover:text-rust"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Label({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.13em] text-faint ${
        inline ? "" : "mt-3 block pb-1"
      }`}
    >
      {children}
    </span>
  );
}
