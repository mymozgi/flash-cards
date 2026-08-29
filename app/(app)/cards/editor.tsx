"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { renderMarkdown } from "@/lib/markdown";
import { saveCard, type CardFormState } from "./actions";

const DRAFT_KEY = "kartoteka:draft";
const initial: CardFormState = { error: null };

export type EditorCard = {
  id: string;
  front_md: string;
  back_md: string;
  note_md: string;
  topicPath: string;
  tags: string[];
};

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
  topicPaths,
  knownTags,
}: {
  card?: EditorCard;
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

  // Черновик читается как внешнее хранилище: на сервере его нет, на клиенте есть,
  // и подставляется он не молча, а по кнопке — чтобы не затирать начатый ввод.
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

  return (
    <form action={formAction} onSubmit={clearDraft} className="flex flex-col gap-5">
      {card && <input type="hidden" name="id" value={card.id} />}

      {offerDraft && (
        <div className="flex flex-wrap items-center gap-3 rounded border-l-[3px] border-accent bg-surface px-4 py-3 text-sm">
          <span className="text-muted">Остался несохранённый черновик.</span>
          <button type="button" onClick={restoreDraft} className="font-medium text-accent">
            Восстановить
          </button>
          <button type="button" onClick={dismissDraft} className="text-faint hover:text-ink">
            Удалить
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Side label="Вопрос" name="front_md" value={front} onChange={setFront} required />
        <Side label="Ответ" name="back_md" value={back} onChange={setBack} required />
      </div>

      <Field label="Заметка — видна только после ответа">
        <textarea
          name="note_md"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Тема — путь через /">
          <input
            name="topic_path"
            value={topicPath}
            onChange={(e) => setTopicPath(e.target.value)}
            list="topic-paths"
            placeholder="Английский / Грамматика / Времена"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
          <datalist id="topic-paths">
            {topicPaths.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        </Field>

        <Field label="Теги — через запятую">
          <input
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            list="known-tags"
            placeholder="слова, на-собеседование"
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm"
          />
          <datalist id="known-tags">
            {knownTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Field>
      </div>

      {isNew && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="reversed" className="size-4 accent-[var(--accent)]" />
          Создать и обратную карточку — со своим расписанием
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
          disabled={pending}
          className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-60"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
        {isNew && (
          <button
            type="submit"
            name="intent"
            value="save_and_new"
            disabled={pending}
            className="min-h-11 rounded border border-line px-5 text-sm disabled:opacity-60"
          >
            Сохранить и создать ещё
          </button>
        )}
        <Link href="/library" className="ml-auto py-2 text-sm text-faint hover:text-ink">
          Отмена
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
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
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
          {preview ? "Править" : "Превью"}
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
          rows={6}
          className="min-h-32 w-full resize-y rounded border border-line bg-surface px-3 py-2 font-sans text-sm"
        />
      )}
    </div>
  );
}
