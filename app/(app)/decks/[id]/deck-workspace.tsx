"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  removeCard,
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
import { COVER_ASPECT, COVER_LONG_SIDE, ImageError, MAX_IMAGES_PER_SIDE } from "@/lib/image";
import { safeUrl } from "@/lib/url";
import { discardUpload, uploadCover, uploadImage } from "@/lib/upload";
import { Button, LinkButton } from "@/components/ui/button";
import { cellInputClass, inputClass, Label as FieldLabel } from "@/components/ui/field";
import { panelClass } from "@/components/ui/panel";
import { useConfirm } from "@/components/ui/confirm";
/*
  Перенос карточек и выбор категории берутся готовыми, а не пишутся заново.
  Действие на сервере одно на всё приложение: разойдясь, две реализации
  «переложить карточку» дали бы две истории повторений одного знания.
*/
import { bulkUpdate, createCategoryFromPath } from "../../library/actions";
import { useCategoryPicker, type PickableCategory } from "@/components/ui/category-picker";
import { useReorder } from "@/components/use-reorder";
import { Switch } from "@/components/ui/switch";
import {
  CheckIcon,
  ChevronIcon,
  GripIcon,
  GridIcon,
  ImageIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  TrashIcon,
} from "@/components/icons";

const OPTION_SLOTS = 5;

/**
 * Примеры в пустых полях.
 *
 * Показывают, КАК выглядит хорошая запись, а не повторяют подпись: текст
 * «Example…» под подписью «Example» не сообщает ничего и только заполняет
 * собой место.
 *
 * Пример намеренно общеизвестный и один на все поля: столицы понятны любому,
 * и видно, как вопрос, ответ, пример и заметка складываются в одну карточку.
 * Прежде здесь была электротехника — она объясняла поля только тому, кто и
 * так знает, что такое RMS.
 *
 * Приставка «e.g.» не для красоты: без неё серый пример читают как уже
 * заполненное поле и ищут, где его стереть.
 *
 * Набор один на редактор и на табличный вид. Разойдясь, две копии учили бы
 * разному в двух видах одного и того же экрана.
 */
const PLACEHOLDER = {
  deckName: "e.g. World capitals",
  question: "e.g. What is the capital of Japan?",
  answer: "e.g. Tokyo",
  example: "e.g. Tokyo has been the capital since 1868",
  note: "e.g. Kyoto was the capital before that",
} as const;
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
  /** Ключ обложки в хранилище; null — обложки нет. */
  cover: string | null;
  coverUrl: string;
  parentName: string | null;
};

export function DeckWorkspace({
  deck,
  initialCards,
  userId,
  destinations,
}: {
  deck: Deck;
  initialCards: DeckCard[];
  userId: string;
  /** Куда можно перенести карточки. Текущий набор сюда не попадает. */
  destinations: PickableCategory[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initialCards);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [columns, setColumns] = useState<Set<Column>>(new Set(COLUMNS.map((c) => c.key)));
  const [status, setStatus] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  /** Отмеченные карточки. Пустой набор — панель переноса скрыта. */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Deck | null>(null);
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
      note: "",
      source: "",
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
    // иначе счётчик «N selected» считал бы удалённую, а перенос отправил бы
    // на сервер идентификатор, которого там уже нет
    setPicked((prev) => {
      if (!prev.has(card.id)) return prev;
      const next = new Set(prev);
      next.delete(card.id);
      return next;
    });
    if (!card.isNew) {
      const res = await removeCard(card.id);
      if (!res.ok) setStatus({ kind: "error", text: res.error ?? "Could not delete the card" });
    }
  };

  const togglePicked = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /*
    Создание набора на лету идёт через `createCategoryFromPath`, и здесь это
    ровно то, что нужно: для односегментного имени он ставит род `deck`. В
    мастере импорта тот же вызов был бы ошибкой — там выбирают КАТЕГОРИЮ, —
    а карточке нужен именно набор.
  */
  const { ask: pickDestination, dialog: destinationDialog } = useCategoryPicker(
    destinations,
    createCategoryFromPath,
  );

  const movePicked = async () => {
    const ids = [...picked];
    if (ids.length === 0) return;

    /*
      Несохранённая правка при переносе пропала бы молча: карточка уезжает из
      списка, а её изменения живут только здесь, в состоянии страницы.
      Поэтому не переносим, а говорим, что мешает, — кнопка сохранения стоит
      рядом и показывает то же число.
    */
    const unsaved = ids.filter((id) => dirty.has(id)).length;
    if (unsaved > 0) {
      setStatus({
        kind: "error",
        text: `Save first: ${unsaved} of the selected ${
          unsaved === 1 ? "card has unsaved changes" : "cards have unsaved changes"
        }, and moving would discard them.`,
      });
      return;
    }

    const topicId = await pickDestination({
      title: `Move ${ids.length} ${ids.length === 1 ? "card" : "cards"}`,
      description:
        "Pick the set they move into, or create a new one. Their review history is untouched.",
      confirmLabel: "Move",
    });
    // undefined — передумали. null здесь не бывает: allowNone не предлагается,
    // карточке нужно место, а «нигде» местом не является.
    if (topicId === undefined || topicId === null) return;

    const res = await bulkUpdate({ action: "move_topic", cardIds: ids, topicId });
    if (!res.ok) {
      setStatus({ kind: "error", text: res.error ?? "Could not move the cards" });
      return;
    }

    setCards((prev) => prev.filter((card) => !picked.has(card.id)));
    setPicked(new Set());
    setStatus({
      kind: "ok",
      text: `Moved ${ids.length} ${ids.length === 1 ? "card" : "cards"} out of this set`,
    });
    router.refresh();
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

  /**
   * Замена изображения на месте: новое встаёт в ту же позицию, старое
   * помечается к уборке. Удалить и добавить заново не то же самое — так
   * изображение уехало бы в конец списка, а порядок здесь виден на карточке.
   */
  const replaceImage = async (
    card: DeckCard,
    side: "front" | "back",
    index: number,
    file: File,
  ) => {
    const key = side === "front" ? "frontImages" : "backImages";
    const old = card[key][index];
    if (!old) return;

    setUploading(true);
    try {
      const fresh = await uploadImage(userId, card.id, file);
      update(card.id, {
        [key]: card[key].map((img, i) => (i === index ? fresh : img)),
      } as Partial<DeckCard>);
      void discardUpload(old);
    } catch (e) {
      setStatus({
        kind: "error",
        text:
          e instanceof ImageError || e instanceof Error
            ? e.message
            : "Could not replace the image",
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
    // Потерянный Source — не отказ, но и не норма: сказать об этом обязаны
    if (res.warning) {
      setStatus({ kind: "error", text: res.warning });
      return;
    }
    setStatus({ kind: "ok", text: `Saved ${res.saved} card${res.saved === 1 ? "" : "s"}` });
    router.refresh();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) =>
      [card.term, card.example, ...card.options].some((field) =>
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

  return (
    /*
      Одна колонка: шапка сверху, карточки под ней, страница прокручивается
      целиком как документ.

      Раньше здесь была сетка со второй колонкой в 23rem, и та колонка
      залипала. Залипающая панель сведений отбирала пятую часть ширины у
      единственной работы этого экрана — правки карточек, — и делала это
      постоянно, ради имени и обложки, которые нужны один раз при входе.
      Шапка принадлежит странице, а не окну просмотра, и уезжает вместе с ней.
    */
    <div className="flex flex-col gap-4">
      {dialog}
      {destinationDialog}
      <DeckHeader
        deck={deck}
        userId={userId}
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
            cover: details.cover,
          });
          if (!res.ok) {
            setStatus({ kind: "error", text: res.error ?? "Could not save the deck" });
            return;
          }
          setDetails(null);
          router.refresh();
        }}
      >

        {/* Ряд управления живёт в той же шапке: поиск, вид, учебные экраны и
            сохранение — это действия НАД этим набором, и отрывать их от его
            имени незачем. */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
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
      </DeckHeader>

      <div className="flex min-w-0 flex-col gap-4">
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
          </div>
        </div>


        {/*
          Панель появляется только когда что-то отмечено, и стоит над списком
          обычным блоком. Залипания у неё нет намеренно: страница
          прокручивается целиком как документ, плавающих тулбаров на ней нет.

          Цена известна: отметив карточку в самом низу длинной колоды, за
          кнопкой переноса придётся подняться наверх. Выбор при этом не
          теряется — он переживает и прокрутку, и поиск.
        */}
        {picked.size > 0 && (
          <div className={`${PANEL} flex flex-wrap items-center gap-2 p-2`}>
            <span className="px-2 text-sm font-semibold tabular-nums">
              {picked.size} selected
            </span>
            <Button size="sm" tone="primary" onClick={movePicked}>
              Move to another set…
            </Button>
            <Button size="sm" tone="ghost" onClick={() => setPicked(new Set())}>
              Clear
            </Button>
          </div>
        )}

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
                  picked={picked.has(card.id)}
                  onTogglePicked={() => togglePicked(card.id)}
                  compact={view === "grid"}
                  collapsed={collapsed.has(card.id)}
                  onToggleCollapse={() => toggleCollapsed(card.id)}
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
                  onReplaceImage={replaceImage}
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
    </div>
  );
}

/** Короткая сторона при рекомендованной пропорции — считаем, а не пишем руками. */
const COVER_HINT_SHORT = Math.round(
  COVER_LONG_SIDE / (Number(COVER_ASPECT.split("/")[0]) / Number(COVER_ASPECT.split("/")[1])),
);

function CoverField({
  url,
  userId,
  topicId,
  onChange,
}: {
  url: string;
  userId: string;
  topicId: string;
  onChange: (cover: string | null, coverUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadCover(userId, topicId, file);
      onChange(uploaded.storagePath, uploaded.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload the cover");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Label>Cover</Label>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {url ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative block h-20 w-32 overflow-hidden rounded-lg border border-line">
            <img src={url} alt="" className="absolute inset-0 m-auto h-full w-auto max-w-none" />
          </span>
          <Button size="sm" onClick={() => input.current?.click()} loading={busy}>
            Replace
          </Button>
          <Button size="sm" tone="danger" onClick={() => onChange(null, "")}>
            Remove
          </Button>
        </div>
      ) : (
        /* Та же зона, что у картинок карточки: попасть в область проще,
           чем в строчку текста */
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-control border-dashed border-line-strong px-4 py-5 text-center disabled:opacity-60"
        >
          <ImageIcon className="size-6 text-faint" />
          <span className="text-sm font-semibold text-accent">
            {busy ? "Uploading…" : "Add a cover"}
          </span>
          {/* Требования названы числами, а не «желательно покрупнее»: угадывать
              размер под чужую вёрстку — не работа пользователя. Сами числа
              берутся из констант конвейера, поэтому подсказка не разойдётся
              с тем, что код действительно делает. */}
          <span className="text-2xs text-faint">
            Best at {COVER_ASPECT.replace(" / ", ":")} — {COVER_LONG_SIDE} × {COVER_HINT_SHORT} px
          </span>
          <span className="text-2xs text-faint">
            Any shape works: covers are fitted whole, never cropped. Larger files are scaled down
            to {COVER_LONG_SIDE} px on the long side.
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-2xs text-rust">
          {error}
        </p>
      )}
    </div>
  );
}

function DeckHeader({
  deck,
  count,
  userId,
  className = "",
  editing,
  onEdit,
  onCancel,
  onChange,
  onSave,
  children,
}: {
  deck: Deck;
  count: number;
  userId: string;
  className?: string;
  /** Ряд управления. Живёт в шапке, потому что относится к этому же набору. */
  children?: React.ReactNode;
  editing: Deck | null;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (patch: Partial<Deck>) => void;
  onSave: () => void;
}) {
  return (
    /*
      Полоса акцента слева опознаёт набор цветом, не тратя на это ни строки
      текста. Она сделана рамкой, а не отдельным элементом: так она лежит
      внутри скругления контейнера и не спорит с ним углом.
    */
    <header
      className={`${PANEL} border-l-4 p-4 sm:p-5 ${className}`}
      style={{ borderLeftColor: deck.color || "var(--accent)" }}
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <input
            value={editing.name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-label="Deck name"
            placeholder={PLACEHOLDER.deckName}
            className={`${FIELD} text-2xl font-semibold`}
          />
          <textarea
            value={editing.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            placeholder="What is this deck about?"
            className={`${FIELD} resize-y`}
          />
          <CoverField
            url={editing.coverUrl}
            userId={userId}
            topicId={deck.id}
            onChange={(cover, coverUrl) => onChange({ cover, coverUrl })}
          />

          <label className="flex items-center gap-2 text-sm text-muted">
            Colour
            <input
              type="color"
              value={editing.color || "#2563eb"}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-14 rounded-lg border-control border-field-line bg-surface"
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
          {/*
            Шапка страницы: обложка слева, сведения справа. В узкой колонке
            обложка стояла над именем, потому что рядом ей места не было;
            теперь шапка во всю ширину, и горизонтальный ряд читается как
            заголовок раздела.
          */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {deck.coverUrl && (
              /* Вписывается целиком, а не кадрируется: у схемы или обложки
                 срезанный край отнимает смысл. */
              <div
                className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-40"
                style={{
                  background: `color-mix(in srgb, ${deck.color || "var(--accent)"} 12%, var(--surface))`,
                }}
              >
                <img
                  src={deck.coverUrl}
                  alt=""
                  className="absolute inset-0 m-auto h-full w-auto max-w-none"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-semibold tracking-tight">{deck.name}</h1>
              {/* Счётчик и категория одной строкой через точку: это подпись
                  под именем, а не набор самостоятельных меток. */}
              <p className="mt-1.5 text-sm text-muted">
                <span className="tabular-nums">{count}</span>{" "}
                {count === 1 ? "card" : "cards"}
                {deck.parentName && (
                  <>
                    {" · "}
                    <span className="text-ink">{deck.parentName}</span>
                  </>
                )}
              </p>
              {deck.description && (
                <p className="mt-2 max-w-prose text-sm text-muted">{deck.description}</p>
              )}
            </div>

            <Button onClick={onEdit} className="shrink-0 self-start">
              <PencilIcon />
              Edit details
            </Button>
          </div>
        </>
      )}
      {children}
    </header>
  );
}

/**
 * Подпись раздела внутри карточки.
 *
 * Сама подпись — примитив дизайн-системы; здесь к ней добавлен только ритм
 * между разделами. Прежде тут жила своя строка классов с приглушённым цветом,
 * и подпись раздела выглядела слабее, чем подпись поля в других местах.
 *
 * Отступ сверху и есть то, что разделяет разделы: границами это делать не
 * нужно, их в карточке и так достаточно. Первой подписи отступ не достаётся —
 * над ней уже поле контейнера.
 */
function Label({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      <FieldLabel required={required} hint={hint}>
        {children}
      </FieldLabel>
    </div>
  );
}

function CardBlock({
  card,
  index,
  picked,
  onTogglePicked,
  compact,
  collapsed,
  onToggleCollapse,
  uploading,
  lifted,
  grip,
  onUpdate,
  onOption,
  onDelete,
  onAddImages,
  onPatchImages,
  onReplaceImage,
}: {
  card: DeckCard;
  index: number;
  /** Карточка отмечена для переноса. */
  picked: boolean;
  onTogglePicked: () => void;
  compact: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  onReplaceImage: (card: DeckCard, side: "front" | "back", index: number, file: File) => void;
}) {
  return (
    /*
      Карточка — свёртываемый модуль: шапка с органами управления и тело с
      полями. Отступ снят с контейнера и роздан шапке и телу по отдельности,
      иначе заливка шапки не дотянулась бы до краёв и читалась бы вставкой
      внутрь, а не собственной областью.
    */
    <article
      className={`overflow-hidden rounded-xl border transition-shadow ${
        lifted
          ? "border-accent bg-surface shadow-raised"
          : picked
            ? "border-accent"
            : "border-line"
      }`}
    >
      {/* Шапка отличается тоном, а не рамкой: сообщить «это область
          управления» тонального сдвига достаточно, а лишняя рамка спорила бы
          с рамкой самой карточки. */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 ${
          picked ? "bg-accent-soft" : "bg-surface-2"
        } ${collapsed ? "" : "border-b border-line"}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* Флажок перед ручкой переноса: сначала «какие», потом «куда».
              Новую карточку отмечать нечем — на сервере её ещё нет. */}
          {!card.isNew && (
            <input
              type="checkbox"
              checked={picked}
              onChange={onTogglePicked}
              aria-label={`Select ${card.term || "this untitled card"}`}
              className="size-4 shrink-0 accent-[var(--accent)]"
            />
          )}
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
            className="flex items-center text-faint transition-transform duration-200 hover:text-ink motion-reduce:transition-none"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
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
      /*
        Колонки разведены широким зазором: предпросмотр — отдельная вещь, а
        не продолжение полей. Прижатый к ним, он читался как ещё одно поле.
      */
      <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
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

      <Label required>Question</Label>
      <textarea
        value={card.term}
        onChange={(e) => onUpdate(card.id, { term: e.target.value })}
        rows={compact ? 2 : 3}
        placeholder={PLACEHOLDER.question}
        className={`${FIELD} resize-y`}
      />

      <div className="mt-4">
        <ImageStrip
          images={card.frontImages}
          busy={uploading}
          onAdd={(files) => onAddImages(card, "front", files)}
          onRemove={(i) => {
            const image = card.frontImages[i];
            onPatchImages(card, "front", card.frontImages.filter((_, k) => k !== i));
            void discardUpload(image);
          }}
          onReplace={(i, file) => onReplaceImage(card, "front", i, file)}
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
          <Label required>Answer</Label>
          <textarea
            value={card.options[card.correctIndex] ?? ""}
            onChange={(e) => onOption(card, card.correctIndex, e.target.value)}
            rows={compact ? 2 : 3}
            placeholder={PLACEHOLDER.answer}
            className={`${FIELD} resize-y`}
          />
        </>
      )}

      <div className="mt-4">
        <ImageStrip
          images={card.backImages}
          busy={uploading}
          onAdd={(files) => onAddImages(card, "back", files)}
          onRemove={(i) => {
            const image = card.backImages[i];
            onPatchImages(card, "back", card.backImages.filter((_, k) => k !== i));
            void discardUpload(image);
          }}
          onReplace={(i, file) => onReplaceImage(card, "back", i, file)}
          onMove={(i, delta) => {
            const next = [...card.backImages];
            const target = i + delta;
            if (target < 0 || target >= next.length) return;
            [next[i], next[target]] = [next[target], next[i]];
            onPatchImages(card, "back", next);
          }}
        />
      </div>

      <Label hint="A concrete case that makes the idea easier to hold on to.">Example</Label>
      <input
        value={card.example}
        onChange={(e) => onUpdate(card.id, { example: e.target.value })}
        placeholder={PLACEHOLDER.example}
        className={FIELD}
      />

      <Label hint="Shown only after the answer. Mnemonics, counter-examples, anything that would give the answer away too early.">Note</Label>
      <textarea
        value={card.note}
        onChange={(e) => onUpdate(card.id, { note: e.target.value })}
        rows={2}
        placeholder={PLACEHOLDER.note}
        className={`${FIELD} resize-y`}
      />

      <Label hint="Where this knowledge came from: a book, an article, a video. http and https links only.">Source</Label>
      {/* Ссылка, а не текст: у источника есть адрес, и половина смысла поля
          в том, чтобы вернуться к нему одним нажатием. Схему можно не писать,
          допишется https:// */}
      <input
        value={card.source}
        onChange={(e) => onUpdate(card.id, { source: e.target.value })}
        placeholder="goodreads.com/book/…"
        inputMode="url"
        className={FIELD}
      />
      {card.source.trim() !== "" && safeUrl(card.source) === null && (
        <p role="alert" className="mt-1.5 text-2xs text-rust">
          Only http and https links are saved — this one will be dropped.
        </p>
      )}

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
  onToggleColumn,
  onUpdate,
  onOption,
  onDelete,
}: {
  cards: DeckCard[];
  columns: Set<Column>;
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
                      placeholder={PLACEHOLDER.question}
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
                      placeholder={PLACEHOLDER.answer}
                      className={`${CELL_FIELD} resize-y`}
                    />
                  </td>
                )}
                {columns.has("example") && (
                  <td className={`${cell} w-40`}>
                    <input
                      value={card.example}
                      onChange={(e) => onUpdate(card.id, { example: e.target.value })}
                      placeholder={PLACEHOLDER.example}
                      className={CELL_FIELD}
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

/**
 * Теги карточки как чипы. Пустое состояние честно говорит «тегов нет»,
 * а не притворяется полем ввода, — так видно, что добавить их можно.
 * Нормализация та же, что на сервере: нижний регистр, пробелы в дефисы.
 */
