"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTagEverywhere,
  removeCard,
  renameTagEverywhere,
  saveDeck,
  saveOrder,
  updateDeck,
  type DeckCardInput,
} from "./actions";
import { renderMarkdown } from "@/lib/markdown";
import {
  CardRenderer,
  LAYOUT_OPTIONS,
  POSITION_OPTIONS,
  SHAPE_OPTIONS,
} from "@/components/card-renderer";
import { ImageStrip } from "@/components/image-strip";
import type { EditorImage } from "@/lib/types";
import { ImageError, MAX_IMAGES_PER_SIDE } from "@/lib/image";
import { discardUpload, uploadImage } from "@/lib/upload";
import { Button, LinkButton } from "@/components/ui/button";
import { cellInputClass, inputClass } from "@/components/ui/field";
import { panelClass } from "@/components/ui/panel";
import { useConfirm } from "@/components/ui/confirm";
import { useReorder } from "@/components/use-reorder";
import { Switch } from "@/components/ui/switch";
import {
  CheckIcon,
  ChevronIcon,
  GripIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  TagIcon,
  TrashIcon,
} from "@/components/icons";

const OPTION_SLOTS = 5;
const VIEWS = [
  { key: "list", label: "List", Icon: ListIcon },
  { key: "grid", label: "Grid", Icon: GridIcon },
  { key: "sheet", label: "Spreadsheet", Icon: TableIcon },
] as const;
type View = (typeof VIEWS)[number]["key"];

const COLUMNS = [
  { key: "term", label: "Term" },
  { key: "definition", label: "Definition" },
  { key: "example", label: "Example (optional)" },
  { key: "tags", label: "Tags" },
  { key: "answers", label: "Answers" },
] as const;
type Column = (typeof COLUMNS)[number]["key"];



/** В редакторе у изображений есть ещё и адреса — сервер их просто игнорирует. */
export type DeckCard = Omit<DeckCardInput, "frontImages" | "backImages"> & {
  frontImages: EditorImage[];
  backImages: EditorImage[];
};

// Вид полей и поверхностей задаётся дизайн-системой, а не локальной копией строки
const FIELD = inputClass;
const CELL_FIELD = cellInputClass;
const PANEL = panelClass;

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
  allTags,
  userId,
}: {
  deck: Deck;
  initialCards: DeckCard[];
  allTags: string[];
  userId: string;
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
  const [showTags, setShowTags] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { ask, dialog } = useConfirm();

  /**
   * Свёрнутые карточки. В длинной колоде развёрнутый редактор на каждую —
   * это километры прокрутки, поэтому от шести карточек список открывается
   * свёрнутым. В короткой сворачивать нечего, там всё видно сразу.
   */
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(initialCards.length > 5 ? initialCards.map((card) => card.id) : []),
  );

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const touch = (id: string) => setDirty((prev) => new Set(prev).add(id));

  const update = (id: string, patch: Partial<DeckCard>) => {
    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, ...patch } : card)));
    touch(id);
  };

  const setOption = (card: DeckCard, index: number, value: string) =>
    update(card.id, {
      options: card.options.map((option, i) => (i === index ? value : option)),
    });

  const addCard = () => {
    const card: DeckCard = {
      id: crypto.randomUUID(),
      isNew: true,
      term: "",
      options: Array(OPTION_SLOTS).fill(""),
      correctIndex: 0,
      example: "",
      mcq: false,
      tags: "",
      note: "",
      suspended: false,
      shape: "square",
      layout: "split",
      imagePosition: "top",
      frontImages: [],
      backImages: [],
    };
    setCards((prev) => [...prev, card]);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(card.id);
      return next;
    });
    touch(card.id);
  };

  const drop = async (card: DeckCard) => {
    if (!card.isNew) {
      const confirmed = await ask({
        title: `Delete “${card.term || "this untitled card"}”?`,
        description: "It moves to the trash and can be restored within 30 days.",
        confirmLabel: "Move to trash",
      });
      if (!confirmed) return;
    }
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

  const addImages = async (card: DeckCard, side: "front" | "back", files: File[]) => {
    const key = side === "front" ? "frontImages" : "backImages";
    const room = MAX_IMAGES_PER_SIDE - card[key].length;
    if (room <= 0) {
      setStatus({ kind: "error", text: `At most ${MAX_IMAGES_PER_SIDE} images per side` });
      return;
    }

    setUploading(true);
    try {
      const uploaded: EditorImage[] = [];
      for (const file of files.slice(0, room)) {
        uploaded.push(await uploadImage(userId, card.id, file));
      }
      update(card.id, { [key]: [...card[key], ...uploaded] } as Partial<DeckCard>);
    } catch (e) {
      setStatus({
        kind: "error",
        text: e instanceof ImageError || e instanceof Error ? e.message : "Could not add the image",
      });
    } finally {
      setUploading(false);
    }
  };

  const patchImages = (card: DeckCard, side: "front" | "back", next: EditorImage[]) => {
    const key = side === "front" ? "frontImages" : "backImages";
    update(card.id, { [key]: next } as Partial<DeckCard>);
  };

  const move = useCallback((from: number, to: number) => {
    setCards((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setOrderDirty(true);
  }, []);

  const save = async () => {
    const pending = cards.filter((card) => dirty.has(card.id));
    if (pending.length === 0 && !orderDirty) {
      setStatus({ kind: "ok", text: "Nothing to save" });
      return;
    }
    setSaving(true);
    setStatus(null);

    const order = cards.map((card) => card.id);
    const res = await saveDeck(deck.id, pending, order);
    // Отказ сохранения порядка больше не проглатывается: раньше он был не
    // виден, и карточки молча возвращались к прежней расстановке
    const ordered = res.ok && orderDirty ? await saveOrder(deck.id, order) : { ok: true as const };
    setSaving(false);

    if (!res.ok) {
      setStatus({ kind: "error", text: res.error ?? "Could not save" });
      return;
    }
    if (!ordered.ok) {
      setStatus({ kind: "error", text: ordered.error ?? "Could not save the card order" });
      return;
    }
    setOrderDirty(false);
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

  /**
   * Порядок меняется только в неотфильтрованном списке. При активном поиске
   * видна часть колоды, и перестановка внутри неё дала бы порядок, которого
   * пользователь не видит и не может проверить.
   */
  const canReorder = query.trim() === "";
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const reorderable = useReorder({
    ids: cardIds,
    onMove: move,
    enabled: canReorder,
    simple: view === "grid",
  });

  const deckTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of cards) {
      for (const tag of card.tags.split(",").map((t) => t.trim()).filter(Boolean)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  return (
    <div className="flex flex-col gap-4">
      {dialog}
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

      <div className={`${PANEL} flex flex-wrap items-center gap-2 p-2`}>
        <div className="relative w-full min-w-0 sm:flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards…"
            aria-label="Search cards"
            className={`${FIELD} pl-9`}
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-line bg-surface-2 p-1">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              aria-pressed={view === item.key}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
                view === item.key
                  ? "bg-surface font-medium text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              <item.Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        <LinkButton href={`/decks/${deck.id}/study`}>Study</LinkButton>
        <LinkButton href={`/review?free=1&topic=${deck.id}`}>Practice</LinkButton>

        <Button tone="primary" onClick={save} loading={saving} disabled={uploading}>
          {!saving && <CheckIcon />}
          {saving ? "Saving…" : dirty.size > 0 ? `Save ${dirty.size}` : orderDirty ? "Save order" : "Save cards"}
        </Button>
      </div>

      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === "error"
              ? "bg-rust-soft text-rust"
              : "bg-accent-soft text-accent"
          }`}
        >
          {status.text}
        </p>
      )}

      <section className={`${PANEL} p-3 sm:p-5`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Flashcards</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                setCollapsed((prev) =>
                  prev.size === cards.length ? new Set() : new Set(cards.map((c) => c.id)),
                )
              }
            >
              {collapsed.size === cards.length && cards.length > 0 ? "Expand all" : "Collapse all"}
            </Button>
            <Button size="sm" onClick={() => setShowTags((v) => !v)} aria-expanded={showTags}>
              <TagIcon />
              Manage tags
            </Button>
          </div>
        </div>

        {showTags && (
          <ManageTags
            tags={deckTags}
            onFilter={setQuery}
            onDone={(text) => setStatus({ kind: "ok", text })}
            onError={(text) => setStatus({ kind: "error", text })}
          />
        )}

        {view === "sheet" ? (
          <Spreadsheet
            cards={visible}
            columns={columns}
            allTags={allTags}
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
          <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-4"}>
            {visible.map((card, index) => (
              <div
                key={card.id}
                ref={reorderable.register(card.id)}
                style={reorderable.itemStyle(card.id, index)}
                className={
                  reorderable.insertionAt === index && reorderable.draggingId !== card.id
                    ? "rounded-xl outline-2 outline-offset-4 outline-accent"
                    : undefined
                }
              >
                <CardBlock
                  card={card}
                  index={index + 1}
                  compact={view === "grid"}
                  collapsed={collapsed.has(card.id)}
                  onToggleCollapse={() => toggleCollapsed(card.id)}
                  allTags={allTags}
                  uploading={uploading}
                  lifted={reorderable.draggingId === card.id}
                  grip={
                    canReorder
                      ? {
                          ...reorderable.grabProps(card.id, index),
                          ...reorderable.keyProps(card.id, index),
                        }
                      : null
                  }
                  onUpdate={update}
                  onOption={setOption}
                  onDelete={drop}
                  onAddImages={addImages}
                  onPatchImages={patchImages}
                />
              </div>
            ))}
          </div>
        )}

        {/* Перенос без мыши должен быть слышен: без этого стрелки двигают
            карточку молча и понять, куда она приехала, невозможно */}
        <p aria-live="polite" className="sr-only">
          {reorderable.announcement}
        </p>

        {visible.length === 0 && (
          <p className="py-12 text-center text-sm text-muted">
            {cards.length === 0 ? "This deck is empty." : "No cards match the search."}
          </p>
        )}

        {/* Кнопка липнет ко дну: в длинной колоде она уезжала за экран,
            и чтобы добавить карточку, приходилось прокручивать весь список.
            Тень отделяет её от содержимого, под которым она проходит. */}
        <div className="sticky bottom-4 z-10 mt-5 flex justify-center pb-[env(safe-area-inset-bottom)]">
          <Button tone="primary" size="lg" onClick={addCard} className="px-8 shadow-raised">
            <PlusIcon /> Add card
          </Button>
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
    <header className={`${PANEL} p-4 sm:p-5`}>
      {editing ? (
        <div className="flex flex-col gap-3">
          <input
            value={editing.name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-label="Deck name"
            className={`${FIELD} text-2xl font-semibold`}
          />
          <textarea
            value={editing.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="What is this deck about?"
            className={`${FIELD} resize-y`}
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Colour
            <input
              type="color"
              value={editing.color || "#2563eb"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-14 rounded-lg border border-line bg-surface"
            />
          </label>
          <div className="flex gap-2">
            <Button tone="primary" onClick={onSave}>
              Save details
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{deck.name}</h1>
            <div className="flex shrink-0 items-center gap-3">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: deck.color || "var(--accent)" }}
              />
              <Button size="sm" onClick={onEdit}>
                <PencilIcon />
                Edit details
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-line px-3 py-1 text-muted">
              {count} {count === 1 ? "card" : "cards"}
            </span>
            {deck.parentName && (
              <span className="rounded-full border border-line px-3 py-1 text-muted">
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

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mt-4 block pb-1.5 text-sm font-medium text-muted">{children}</span>;
}

function CardBlock({
  card,
  index,
  compact,
  collapsed,
  onToggleCollapse,
  allTags,
  uploading,
  lifted,
  grip,
  onUpdate,
  onOption,
  onDelete,
  onAddImages,
  onPatchImages,
}: {
  card: DeckCard;
  index: number;
  compact: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  allTags: string[];
  uploading: boolean;
  /** Карточку сейчас несут: приподнимаем её над соседями. */
  lifted: boolean;
  /** Обработчики ручки переноса. `null` — переносить сейчас нельзя. */
  grip: React.HTMLAttributes<HTMLSpanElement> | null;
  onUpdate: (id: string, patch: Partial<DeckCard>) => void;
  onOption: (card: DeckCard, index: number, value: string) => void;
  onDelete: (card: DeckCard) => void;
  onAddImages: (card: DeckCard, side: "front" | "back", files: File[]) => void;
  onPatchImages: (card: DeckCard, side: "front" | "back", next: EditorImage[]) => void;
}) {
  return (
    <article
      className={`rounded-xl border p-4 transition-shadow ${
        lifted ? "border-accent bg-surface shadow-raised" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {grip && (
            <span
              {...grip}
              title="Drag to reorder, or press space to move it with the arrow keys"
              className="-m-1 cursor-grab touch-none rounded p-1 text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing"
            >
              <GripIcon />
            </span>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand card" : "Collapse card"}
            className="flex items-center text-faint transition-transform duration-200 hover:text-ink"
            style={{ transform: collapsed ? "rotate(-90deg)" : undefined }}
          >
            <ChevronIcon />
          </button>
          <span className="text-sm font-medium text-faint">#{index}</span>
          {/* В свёрнутом виде вместо полей — сам вопрос: по нему карточку и ищут */}
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="min-w-0 flex-1 truncate text-left text-sm text-ink"
            >
              {card.term || <span className="text-faint">Untitled card</span>}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${compact ? "sr-only" : "text-muted"}`}>
            Multiple choice question
          </span>
          <Switch
            checked={card.mcq}
            onChange={(value) => onUpdate(card.id, { mcq: value })}
            label="Multiple choice question"
          />
          <button
            type="button"
            onClick={() => onUpdate(card.id, { suspended: !card.suspended })}
            aria-pressed={card.suspended}
            title={
              card.suspended
                ? "Suspended — kept in the deck, never scheduled"
                : "Suspend: keep the card but drop it from the queue"
            }
            className={`rounded-lg border px-2.5 py-1 text-xs ${
              card.suspended
                ? "border-amber bg-amber-soft text-amber"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            {card.suspended ? "Suspended" : "Suspend"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(card)}
            aria-label="Delete card"
            className="text-faint hover:text-rust"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Слева органы управления, справа живой предпросмотр — тот же компонент,
          которым карточка рисуется в учебных режимах, поэтому расхождений нет. */}
      {!collapsed && (
      <div className="mt-1 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
      <Label>Aspect ratio</Label>
      <div className="flex flex-wrap gap-2">
        {SHAPE_OPTIONS.map((shape) => (
          <button
            key={shape.key}
            type="button"
            onClick={() => onUpdate(card.id, { shape: shape.key })}
            aria-pressed={card.shape === shape.key}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              card.shape === shape.key
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            <span
              aria-hidden
              className={`${shape.box} rounded-sm border-2 ${
                card.shape === shape.key ? "border-accent" : "border-line-strong"
              }`}
            />
            {shape.ratio}
          </button>
        ))}
      </div>

      <Label>Layout</Label>
      <div className="flex flex-wrap gap-2">
        {LAYOUT_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onUpdate(card.id, { layout: option.key })}
            aria-pressed={card.layout === option.key}
            className={`rounded-lg border px-3 py-2 text-xs ${
              card.layout === option.key
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {card.layout === "split" && (
        <>
          <Label>Image position</Label>
          <div className="flex flex-wrap gap-2">
            {POSITION_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onUpdate(card.id, { imagePosition: option.key })}
                aria-pressed={card.imagePosition === option.key}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  card.imagePosition === option.key
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

      <Label>Question</Label>
      <textarea
        value={card.term}
        onChange={(e) => onUpdate(card.id, { term: e.target.value })}
        rows={compact ? 2 : 3}
        className={`${FIELD} resize-y`}
      />

      <div className="mt-2">
        <ImageStrip
          images={card.frontImages}
          busy={uploading}
          onAdd={(files) => onAddImages(card, "front", files)}
          onRemove={(i) => {
            const image = card.frontImages[i];
            onPatchImages(card, "front", card.frontImages.filter((_, k) => k !== i));
            void discardUpload(image);
          }}
          onCaption={(i, caption) =>
            onPatchImages(
              card,
              "front",
              card.frontImages.map((img, k) => (k === i ? { ...img, caption } : img)),
            )
          }
          onMove={(i, delta) => {
            const next = [...card.frontImages];
            const target = i + delta;
            if (target < 0 || target >= next.length) return;
            [next[i], next[target]] = [next[target], next[i]];
            onPatchImages(card, "front", next);
          }}
        />
      </div>

      {card.mcq ? (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-muted">Answer options</span>
            <span className="text-xs text-accent">Select the correct answer</span>
          </div>
          <ul className="mt-1.5 flex flex-col gap-2 border-l-2 border-accent-soft pl-3">
            {card.options.map((option, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <input
                  type="radio"
                  name={`correct-${card.id}`}
                  checked={card.correctIndex === i}
                  onChange={() => onUpdate(card.id, { correctIndex: i })}
                  aria-label={`Mark answer ${i + 1} as correct`}
                  className="mt-2.5 size-4 shrink-0 accent-[var(--accent)]"
                />
                <textarea
                  value={option}
                  onChange={(e) => onOption(card, i, e.target.value)}
                  placeholder={`Answer ${i + 1}`}
                  rows={2}
                  className={`${FIELD} resize-y`}
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
            className={`${FIELD} resize-y`}
          />
        </>
      )}

      <div className="mt-2">
        <ImageStrip
          images={card.backImages}
          busy={uploading}
          onAdd={(files) => onAddImages(card, "back", files)}
          onRemove={(i) => {
            const image = card.backImages[i];
            onPatchImages(card, "back", card.backImages.filter((_, k) => k !== i));
            void discardUpload(image);
          }}
          onCaption={(i, caption) =>
            onPatchImages(
              card,
              "back",
              card.backImages.map((img, k) => (k === i ? { ...img, caption } : img)),
            )
          }
          onMove={(i, delta) => {
            const next = [...card.backImages];
            const target = i + delta;
            if (target < 0 || target >= next.length) return;
            [next[i], next[target]] = [next[target], next[i]];
            onPatchImages(card, "back", next);
          }}
        />
      </div>

      <Label>Example (optional)</Label>
      <input
        value={card.example}
        onChange={(e) => onUpdate(card.id, { example: e.target.value })}
        placeholder="Example…"
        className={FIELD}
      />

      <Label>Note — shown only after the answer</Label>
      <textarea
        value={card.note}
        onChange={(e) => onUpdate(card.id, { note: e.target.value })}
        rows={2}
        placeholder="Source, mnemonic, counter-example…"
        className={`${FIELD} resize-y`}
      />

      <Label>Tags</Label>
      <TagEditor value={card.tags} allTags={allTags} onChange={(tags) => onUpdate(card.id, { tags })} />
        </div>

        {!compact && (
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <span className="mb-1.5 block text-sm font-medium text-muted">Live preview</span>
            <CardRenderer
              shape={card.shape}
              layout={card.layout}
              imagePosition={card.imagePosition}
              html={renderMarkdown(card.term || "_Question_")}
              images={card.frontImages.map((img) => ({ url: img.url, caption: img.caption }))}
            />
            <p className="mt-2 text-xs text-faint">
              Exactly how the card appears while studying.
            </p>
          </aside>
        )}
      </div>
      )}
    </article>
  );
}

function Spreadsheet({
  cards,
  columns,
  allTags,
  onToggleColumn,
  onUpdate,
  onOption,
  onDelete,
}: {
  cards: DeckCard[];
  columns: Set<Column>;
  allTags: string[];
  onToggleColumn: (key: Column) => void;
  onUpdate: (id: string, patch: Partial<DeckCard>) => void;
  onOption: (card: DeckCard, index: number, value: string) => void;
  onDelete: (card: DeckCard) => void;
}) {
  const cell = "border-b border-line px-2 py-2 align-top";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2">
        <span className="mr-1 text-sm font-medium text-muted">View options:</span>
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            type="button"
            onClick={() => onToggleColumn(column.key)}
            aria-pressed={columns.has(column.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              columns.has(column.key)
                ? "bg-accent text-accent-ink"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {column.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
              {COLUMNS.filter((c) => columns.has(c.key)).map((column) => (
                <th key={column.key} className="px-3 py-2.5 font-medium">
                  {column.label}
                </th>
              ))}
              <th className="w-10 px-2 py-2.5" />
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
                      className={`${CELL_FIELD} resize-y`}
                    />
                  </td>
                )}
                {columns.has("definition") && (
                  <td className={cell}>
                    <textarea
                      value={card.options[card.correctIndex] ?? ""}
                      onChange={(e) => onOption(card, card.correctIndex, e.target.value)}
                      rows={2}
                      className={`${CELL_FIELD} resize-y`}
                    />
                  </td>
                )}
                {columns.has("example") && (
                  <td className={`${cell} w-40`}>
                    <input
                      value={card.example}
                      onChange={(e) => onUpdate(card.id, { example: e.target.value })}
                      placeholder="Example…"
                      className={CELL_FIELD}
                    />
                  </td>
                )}
                {columns.has("tags") && (
                  <td className={`${cell} w-32`}>
                    <TagEditor
                      value={card.tags}
                      allTags={allTags}
                      onChange={(tags) => onUpdate(card.id, { tags })}
                      compact
                    />
                  </td>
                )}
                {columns.has("answers") && (
                  <td className={`${cell} w-72`}>
                    <ul className="flex flex-col gap-1">
                      {card.options.map((option, i) => (
                        <li key={i} className="flex items-center gap-2">
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
                            className={CELL_FIELD}
                          />
                          <button
                            type="button"
                            onClick={() => onOption(card, i, "")}
                            aria-label={`Clear option ${i + 1}`}
                            className="shrink-0 text-faint hover:text-rust"
                          >
                            <TrashIcon className="size-3.5" />
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
                    <TrashIcon />
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

function splitTags(value: string): string[] {
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))];
}

/**
 * Теги карточки как чипы. Пустое состояние честно говорит «тегов нет»,
 * а не притворяется полем ввода, — так видно, что добавить их можно.
 * Нормализация та же, что на сервере: нижний регистр, пробелы в дефисы.
 */
function TagEditor({
  value,
  allTags,
  onChange,
  compact,
}: {
  value: string;
  allTags: string[];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const tags = splitTags(value);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) onChange([...tags, tag].join(", "));
    setDraft("");
    setAdding(false);
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag).join(", "));
  const suggestions = allTags.filter((t) => !tags.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.length === 0 && !adding && (
        <span className={compact ? "text-xs text-faint" : "text-sm text-faint"}>No tags yet</span>
      )}

      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            aria-label={`Remove tag ${tag}`}
            className="opacity-60 hover:opacity-100"
          >
            <CloseIcon className="size-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <>
          <input
            autoFocus
            value={draft}
            list="deck-tag-suggestions"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            placeholder="tag name"
            className="w-32 rounded-full border-control border-field-line bg-surface px-3 py-1.5 text-xs"
          />
          <datalist id="deck-tag-suggestions">
            {suggestions.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
        >
          <PlusIcon className="size-3" />
          Add tag
        </button>
      )}
    </div>
  );
}

/**
 * Управление тегами: переименование и удаление действуют по всей базе,
 * а не только в этой колоде. Переименование в уже существующий тег
 * работает как слияние — иначе накопились бы дубли-синонимы.
 */
function ManageTags({
  tags,
  onFilter,
  onDone,
  onError,
}: {
  tags: [string, number][];
  onFilter: (tag: string) => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const { ask, dialog } = useConfirm();

  const rename = (tag: string) => {
    const next = prompt(`Rename “${tag}” everywhere it is used:`, tag);
    if (!next || next === tag) return;
    startTransition(async () => {
      const res = await renameTagEverywhere(tag, next);
      if (!res.ok) return onError(res.error ?? "Could not rename the tag");
      onDone(`Tag renamed to “${next}”`);
      router.refresh();
    });
  };

  const drop = async (tag: string) => {
    const confirmed = await ask({
      title: `Delete the tag “${tag}”?`,
      description: "It is removed from every card that uses it. The cards themselves stay.",
      confirmLabel: "Delete tag",
    });
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteTagEverywhere(tag);
      if (!res.ok) return onError(res.error ?? "Could not delete the tag");
      onDone(`Tag “${tag}” removed`);
      router.refresh();
    });
  };

  return (
    <div className={`mb-4 rounded-lg bg-surface-2 p-3 ${busy ? "opacity-60" : ""}`}>
      {dialog}
      {tags.length === 0 ? (
        <p className="text-sm text-muted">No tags in this deck yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tags.map(([tag, count]) => (
            <li key={tag} className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => onFilter(tag)}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent"
              >
                {tag}
              </button>
              <span className="tabular-nums text-xs text-faint">{count}</span>
              <button
                type="button"
                onClick={() => rename(tag)}
                className="ml-auto text-xs text-muted hover:text-ink"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => drop(tag)}
                aria-label={`Delete tag ${tag}`}
                className="text-faint hover:text-rust"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-faint">
        Renaming into an existing tag merges the two. Changes apply to every card, not just this deck.
      </p>
    </div>
  );
}
