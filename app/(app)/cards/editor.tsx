"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { ImageError, MAX_IMAGES_PER_SIDE, imagesFromClipboard } from "@/lib/image";
import { discardUpload, uploadImage } from "@/lib/upload";
import { saveCard, type CardFormState } from "./actions";
import { ImageStrip } from "./image-strip";
import type { EditorCard, EditorImage } from "./editor-types";

const DRAFT_KEY = "kartoteka:draft";
const initial: CardFormState = { error: null };

type Draft = { front_md: string; back_md: string; note_md: string; topicPath: string; tags: string };

function subscribeDraft(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDraft(): string | null {
  try {
    return localStorage.getItem(DRAFT_KEY);
  } catch {
    return null; // приватный режим или запрещённые куки
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* нечего чистить */
  }
}

export function CardEditor({
  card,
  userId,
  topicPaths,
  knownTags,
}: {
  card?: EditorCard;
  userId: string;
  topicPaths: string[];
  knownTags: string[];
}) {
  const [state, formAction, pending] = useActionState(saveCard, initial);
  const isNew = !card;

  const [front, setFront] = useState(card?.front_md ?? "");
  const [back, setBack] = useState(card?.back_md ?? "");
  const [note, setNote] = useState(card?.note_md ?? "");
  const [topicPath, setTopicPath] = useState(card?.topicPath ?? "");
  const [tags, setTags] = useState(card?.tags.join(", ") ?? "");
  // неправильные варианты для режима выбора ответа: задаются вручную
  const [distractors, setDistractors] = useState<string[]>([
    card?.distractors[0] ?? "",
    card?.distractors[1] ?? "",
    card?.distractors[2] ?? "",
  ]);

  const [frontImages, setFrontImages] = useState<EditorImage[]>(card?.frontImages ?? []);
  const [backImages, setBackImages] = useState<EditorImage[]>(card?.backImages ?? []);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Идентификатор новой карточки нужен раньше вставки в базу — из него строится
  // путь в хранилище. Генерируем в обработчике, а не в рендере: рендер должен
  // оставаться чистым.
  const [draftId, setDraftId] = useState<string | null>(null);
  const cardId = card?.id ?? draftId;

  const stored = useSyncExternalStore(subscribeDraft, readDraft, () => null);
  const [draftHandled, setDraftHandled] = useState(false);

  const draft = useMemo<Draft | null>(() => {
    if (!isNew || !stored) return null;
    try {
      return JSON.parse(stored) as Draft;
    } catch {
      return null;
    }
  }, [isNew, stored]);

  const offerDraft =
    draft !== null && !draftHandled && front.trim() === "" && back.trim() === "" && Boolean(draft.front_md);

  useEffect(() => {
    if (!isNew) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ front_md: front, back_md: back, note_md: note, topicPath, tags }),
        );
      } catch {
        /* без черновика тоже можно работать */
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [isNew, front, back, note, topicPath, tags]);

  const restoreDraft = () => {
    if (!draft) return;
    setFront(draft.front_md ?? "");
    setBack(draft.back_md ?? "");
    setNote(draft.note_md ?? "");
    setTopicPath(draft.topicPath ?? "");
    setTags(typeof draft.tags === "string" ? draft.tags : "");
    setDraftHandled(true);
  };

  const dismissDraft = () => {
    clearDraft();
    setDraftHandled(true);
  };

  const addImages = async (side: "front" | "back", files: File[]) => {
    if (files.length === 0) return;
    const setter = side === "front" ? setFrontImages : setBackImages;
    const existing = side === "front" ? frontImages : backImages;
    const room = MAX_IMAGES_PER_SIDE - existing.length;

    if (room <= 0) {
      setImageError(`At most ${MAX_IMAGES_PER_SIDE} images per side`);
      return;
    }

    const targetId = cardId ?? crypto.randomUUID();
    if (!cardId) setDraftId(targetId);

    setUploading(true);
    setImageError(null);
    try {
      for (const file of files.slice(0, room)) {
        const uploaded = await uploadImage(userId, targetId, file);
        setter((prev) => [...prev, uploaded]);
      }
      if (files.length > room) {
        setImageError(`Took ${room} of ${files.length}: the limit is ${MAX_IMAGES_PER_SIDE} per side`);
      }
    } catch (e) {
      setImageError(
        e instanceof ImageError || e instanceof Error ? e.message : "Could not add the image",
      );
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (side: "front" | "back", index: number) => {
    const setter = side === "front" ? setFrontImages : setBackImages;
    const list = side === "front" ? frontImages : backImages;
    const image = list[index];
    setter((prev) => prev.filter((_, i) => i !== index));
    // файл уже помечен сиротой при загрузке; убираем его сразу, чтобы не ждать уборки
    void discardUpload(image);
  };

  const captionImage = (side: "front" | "back", index: number, caption: string) => {
    const setter = side === "front" ? setFrontImages : setBackImages;
    setter((prev) => prev.map((img, i) => (i === index ? { ...img, caption } : img)));
  };

  const moveImage = (side: "front" | "back", index: number, delta: number) => {
    const setter = side === "front" ? setFrontImages : setBackImages;
    setter((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <form action={formAction} onSubmit={clearDraft} className="flex flex-col gap-5">
      {card && <input type="hidden" name="id" value={card.id} />}
      {!card && draftId && <input type="hidden" name="new_id" value={draftId} />}
      <input type="hidden" name="images_front" value={JSON.stringify(frontImages)} />
      <input type="hidden" name="images_back" value={JSON.stringify(backImages)} />

      {offerDraft && (
        <div className="flex flex-wrap items-center gap-3 rounded border-l-[3px] border-accent bg-surface px-4 py-3 text-sm">
          <span className="text-muted">You have an unsaved draft.</span>
          <button type="button" onClick={restoreDraft} className="font-medium text-accent">
            Restore
          </button>
          <button type="button" onClick={dismissDraft} className="text-faint hover:text-ink">
            Delete
          </button>
        </div>
      )}

      {imageError && (
        <p role="alert" className="rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {imageError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Side
          label="Question"
          name="front_md"
          value={front}
          onChange={setFront}
          onPasteFiles={(files) => void addImages("front", files)}
          required
        >
          <ImageStrip
            images={frontImages}
            busy={uploading}
            onAdd={(files) => void addImages("front", files)}
            onRemove={(i) => removeImage("front", i)}
            onCaption={(i, c) => captionImage("front", i, c)}
            onMove={(i, d) => moveImage("front", i, d)}
          />
        </Side>

        <Side
          label="Answer"
          name="back_md"
          value={back}
          onChange={setBack}
          onPasteFiles={(files) => void addImages("back", files)}
          required
        >
          <ImageStrip
            images={backImages}
            busy={uploading}
            onAdd={(files) => void addImages("back", files)}
            onRemove={(i) => removeImage("back", i)}
            onCaption={(i, c) => captionImage("back", i, c)}
            onMove={(i, d) => moveImage("back", i, d)}
          />
        </Side>
      </div>

      <Field label="Note — shown only after the answer">
        <textarea
          name="note_md"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Topic — path separated by /">
          <input
            name="topic_path"
            value={topicPath}
            onChange={(e) => setTopicPath(e.target.value)}
            list="topic-paths"
            placeholder="English / Grammar / Tenses"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
          <datalist id="topic-paths">
            {topicPaths.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        </Field>

        <Field label="Tags — comma separated">
          <input
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            list="known-tags"
            placeholder="vocabulary, interview-prep"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
          <datalist id="known-tags">
            {knownTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Field>
      </div>

      <fieldset className="rounded border border-line p-3">
        <legend className="px-1 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          Wrong answers — optional, for multiple choice
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {distractors.map((value, index) => (
            <input
              key={index}
              name={`distractor${index + 1}`}
              value={value}
              onChange={(e) =>
                setDistractors((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))
              }
              placeholder={`Wrong answer ${index + 1}`}
              className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          ))}
        </div>
      </fieldset>

      {isNew && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="reversed" className="size-4 accent-[var(--accent)]" />
          Also create the reverse card — with its own schedule
        </label>
      )}

      {state.error && (
        <p role="alert" className="rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending || uploading}
          className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {isNew && (
          <button
            type="submit"
            name="intent"
            value="save_and_new"
            disabled={pending || uploading}
            className="min-h-11 rounded border border-line px-5 text-sm disabled:opacity-60"
          >
            Save and add another
          </button>
        )}
        <Link href="/library" className="ml-auto py-2 text-sm text-faint hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      {children}
    </label>
  );
}

function Side({
  label,
  name,
  value,
  onChange,
  onPasteFiles,
  required,
  children,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  onPasteFiles: (files: File[]) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="text-[11px] text-faint hover:text-ink"
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>
      {preview ? (
        <>
          <div
            className="prose-card min-h-32 rounded border border-line bg-surface px-3 py-2 text-sm"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
          />
          <input type="hidden" name={name} value={value} />
        </>
      ) : (
        <textarea
          name={name}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const files = imagesFromClipboard(e.clipboardData?.items ?? null);
            if (files.length > 0) {
              e.preventDefault();
              onPasteFiles(files);
            }
          }}
          rows={6}
          className="min-h-32 w-full resize-y rounded border border-line bg-surface px-3 py-2 font-sans text-sm"
        />
      )}
      {children}
    </div>
  );
}
