"use client";

import { Button, LinkButton, buttonClass } from "@/components/ui/button";
import { inputClass, selectClass, Label as FieldLabel } from "@/components/ui/field";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import {
  deckNameFromFile,
  fileHasCategories,
  importDestination,
  ImportFormatError,
  parseJson,
  preview as echo,
  sniffFormat,
  type DestinationMode,
  rowPath,
  type Table,
} from "@/lib/import-format";
import { useCategoryPicker, type PickableCategory } from "@/components/ui/category-picker";
import {
  createImportCategory,
  findDuplicates,
  finishImport,
  importRows,
  startImport,
  undoImport,
  type DuplicateStrategy,
  type ImportRow,
} from "./actions";

const MAX_ROWS = 2000;
const CHUNK = 100;
const PREVIEW = 20;

const PASTE_EXAMPLE = `front,back,category,area,note
mitochondrion,powerhouse of the cell,Biology,Cells,makes ATP
ribosome,builds proteins,Biology,Cells,
hippocampus,forms new memories,Medicine,Neuroanatomy,`;

type Field = "front" | "back" | "category" | "area" | "note" | "example" | "source" | "sourceUrl";

/**
 * Поля мастера — это поля ПРИЛОЖЕНИЯ, а не имена колонок в файле.
 *
 * В CSV колонка называется Area, в приложении это Набор; в CSV Front side, в
 * приложении Вопрос. Перевод — работа мастера, и подпись слева обязана
 * говорить на языке приложения, иначе человек ищет в интерфейсе «Area», а
 * её там нет.
 *
 * Объяснение ушло в подсказку. Постоянная строчка «front side» под каждой
 * подписью читается один раз, а место занимает всегда.
 */
const FIELDS: {
  key: Field;
  label: string;
  required?: boolean;
  hint: string;
}[] = [
  {
    key: "front",
    label: "Question",
    required: true,
    hint: "The front of the card. Usually the CSV column named Front side.",
  },
  {
    key: "back",
    label: "Answer",
    required: true,
    hint: "The back of the card. Usually the CSV column named Back side.",
  },
  {
    key: "category",
    label: "Category",
    hint: "Top level. Leave it unmapped to send everything to one category you pick in the next step.",
  },
  {
    key: "area",
    label: "Set",
    hint: "The set inside the category. In CSV this column is usually called Area — each distinct value becomes its own set.",
  },
  { key: "example", label: "Example", hint: "An example or a rule that makes the answer easier to hold on to." },
  { key: "note", label: "Note", hint: "Shown only after the answer, so it cannot give it away." },
  { key: "source", label: "Source", hint: "Readable name of where this came from: a book, a chapter, a lecture." },
  { key: "sourceUrl", label: "Source URL", hint: "Link to the original. Only http and https links are kept." },
];

/** Заголовки в чужих файлах называются как угодно — угадываем самые частые. */
const ALIASES: Record<Field, string[]> = {
  front: ["front", "front side", "question", "term", "word", "prompt", "q", "вопрос", "термин"],
  back: ["back", "back side", "answer", "definition", "translation", "meaning", "a", "ответ"],
  category: ["category", "категория"],
  // «topic» здесь же: в прежних выгрузках так называлась колонка с путём,
  // и чаще всего в ней лежало именно имя набора
  area: ["area", "set", "collection", "deck", "topic", "набор", "тема"],
  example: ["example", "example / rule", "rule", "sample", "пример"],
  note: ["note", "notes", "comment", "hint", "заметка"],
  source: ["source", "citation", "book", "источник"],
  sourceUrl: ["source url", "url", "link", "href", "ссылка"],
};

export type ImportCategory = PickableCategory & { name: string };

type Step = "file" | "map" | "where" | "preview" | "running" | "done";
/** Откуда взялись данные: файл с диска или вставленный текст. */
type Source = "file" | "paste";
type Row = Record<string, string>;

export function ImportWizard({
  categories,
  fixedCategoryId,
}: {
  categories: ImportCategory[];
  /** Импорт запущен из категории: назначение известно и не спрашивается. */
  fixedCategoryId?: string;
}) {
  const fixed = fixedCategoryId
    ? (categories.find((c) => c.id === fixedCategoryId) ?? null)
    : null;

  const [step, setStep] = useState<Step>("file");
  const [source, setSource] = useState<Source>("file");
  /** Данные пришли из собственной выгрузки: колонки уже канонические. */
  const [fromExport, setFromExport] = useState(false);
  const [pasted, setPasted] = useState("");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapping, setMapping] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [strategy, setStrategy] = useState<DuplicateStrategy>("skip");
  /*
    Куда лягут карточки. Раньше этот вопрос вообще не задавался: адресом была
    колонка `topic`, и файл без неё молча создавал карточки нигде. Теперь
    назначение выбирают до записи и видят в предпросмотре.
  */
  const [destMode, setDestMode] = useState<DestinationMode>(fixed ? "single" : "file");
  const [category, setCategory] = useState<{ id: string; name: string } | null>(
    fixed ? { id: fixed.id, name: fixed.name } : null,
  );
  /** Набор для строк без темы: карточка не может лежать прямо в категории. */
  const [fallbackDeck, setFallbackDeck] = useState("Imported");
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    batchId: string;
    created: number;
    skipped: number;
    errors: { line: number; reason: string }[];
  } | null>(null);

  /*
    Категория, созданная прямо в мастере, в списке с сервера отсутствует:
    страница не перерисовывалась. Держим такие рядом, иначе выбор сразу после
    создания не нашёл бы имени и сбросился бы в «не выбрано».
  */
  const [minted, setMinted] = useState<ImportCategory[]>([]);
  const pickable = useMemo(() => [...categories, ...minted], [categories, minted]);

  const { ask: pickCategory, dialog: pickerDialog } = useCategoryPicker(
    pickable,
    // Именно создание КАТЕГОРИИ: действие мастера ставит род `area`
    async (name: string) => {
      const res = await createImportCategory(name);
      const clean = name.trim();
      if (res.id) setMinted((prev) => [...prev, { id: res.id as string, name: clean, path: clean }]);
      return res;
    },
  );

  const chooseCategory = async () => {
    const id = await pickCategory({
      title: "Where do these cards go?",
      description: "Pick the category. The topic inside it comes from the file.",
      confirmLabel: "Use this category",
      current: category?.id ?? null,
    });
    if (id === undefined) return; // передумали
    const hit = pickable.find((c) => c.id === id);
    setCategory(hit ? { id: hit.id, name: hit.name } : null);
  };

  /**
   * Приёмка разобранной таблицы. Одна на все источники: и файл, и вставка, и
   * CSV, и JSON приходят сюда, поэтому сопоставление колонок, поиск дублей и
   * предпросмотр дальше работают одинаково и ничего о происхождении не знают.
   */
  const accept = (table: Table, label: string) => {
    if (table.rows.length === 0) {
      setError("No data rows found. Check that the first line contains column names.");
      return;
    }
    const guess = {} as Record<Field, string>;
    for (const { key } of FIELDS) {
      const hit = table.headers.find((c) => ALIASES[key].includes(c.toLowerCase()));
      if (hit) guess[key] = hit;
    }
    setFilename(label);
    setFallbackDeck(deckNameFromFile(label));
    setFromExport(table.fromExport);
    setHeaders(table.headers);
    setRows(table.rows.slice(0, MAX_ROWS));
    setMapping(guess);
    setStep("map");
    setError(
      table.rows.length > MAX_ROWS
        ? `There are ${table.rows.length} rows; only the first ${MAX_ROWS} will be imported.`
        : null,
    );
  };

  const parseCsv = (input: string | File, label: string) => {
    // PapaParse одинаково принимает и строку, и файл, поэтому ветка здесь одна
    Papa.parse<Row>(input as string, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (result) => {
        accept(
          {
            headers: (result.meta.fields ?? []).filter(Boolean),
            rows: result.data.filter((r) => Object.values(r).some((v) => v?.trim())),
            fromExport: false,
          },
          label,
        );
      },
      error: (e: Error) => setError(`Could not read the data: ${e.message}`),
    });
  };

  const readText = (text: string, label: string) => {
    setError(null);
    if (sniffFormat(text) === "csv") {
      parseCsv(text, label);
      return;
    }
    try {
      accept(parseJson(text), label);
    } catch (e) {
      setError(
        e instanceof ImportFormatError
          ? `${e.message} What you pasted starts with: ${echo(text)}`
          : "Could not read the pasted content.",
      );
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // JSON читаем текстом: PapaParse разобрал бы его как одну колонку с
    // фигурными скобками и молча создал бы мусор
    if (file.name.toLowerCase().endsWith(".json")) {
      readText(await file.text(), file.name);
      return;
    }
    parseCsv(file, file.name);
  };

  const toRow = (raw: Row, index: number): ImportRow => ({
    line: index + 2, // +1 за заголовок, +1 за нумерацию с единицы
    front: raw[mapping.front] ?? "",
    back: raw[mapping.back] ?? "",
    topic: importDestination(
      rowPath(
        mapping.category ? (raw[mapping.category] ?? "") : "",
        mapping.area ? (raw[mapping.area] ?? "") : "",
        "",
      ),
      destMode,
      category?.name ?? null,
      fallbackDeck,
    ),
    note: mapping.note ? (raw[mapping.note] ?? "") : "",
    example: mapping.example ? (raw[mapping.example] ?? "") : "",
    source: mapping.source ? (raw[mapping.source] ?? "") : "",
    sourceUrl: mapping.sourceUrl ? (raw[mapping.sourceUrl] ?? "") : "",
  });

  const prepared = useMemo(
    () => (mapping.front && mapping.back ? rows.map(toRow) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mapping, destMode, category, fallbackDeck],
  );

  /** Адреса из самого файла — до подстановки категории. На них и решают. */
  const fileTopics = useMemo(() => {
    if (!mapping.category && !mapping.area) return [];
    return rows.map((raw) =>
      rowPath(
        mapping.category ? (raw[mapping.category] ?? "") : "",
        mapping.area ? (raw[mapping.area] ?? "") : "",
        "",
      ),
    );
  }, [rows, mapping.category, mapping.area]);

  const hasOwnCategories = useMemo(() => fileHasCategories(fileTopics), [fileTopics]);
  const rowsWithoutTopic = useMemo(
    () => (fileTopics.length === 0 ? rows.length : fileTopics.filter((t) => !t).length),
    [fileTopics, rows.length],
  );

  /** Куда в итоге лягут карточки: готовые пути со счётчиком. */
  const destinations = useMemo(() => {
    const tally = new Map<string, number>();
    for (const row of prepared) {
      const key = row.topic.trim() || "— no category —";
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  }, [prepared]);

  /** Нельзя идти дальше, пока не ясно, куда класть. */
  const destinationReady = destMode === "file" ? hasOwnCategories : category !== null;

  const invalid = prepared.filter((r) => !r.front.trim() || !r.back.trim()).length;
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const dupCount = prepared.filter((r) => duplicates.has(normalize(r.front))).length;
  const newTopics = useMemo(() => {
    const set = new Set(prepared.map((r) => r.topic.trim()).filter(Boolean));
    return [...set];
  }, [prepared]);

  /*
    Режим по умолчанию выставляется здесь, а не эффектом: это следствие
    действия пользователя, а не состояния. Файл со своими категориями их и
    сохраняет; плоский файл требует выбрать категорию явно.
  */
  const goWhere = () => {
    setError(null);
    // У закреплённой категории режим один: всё ложится в неё
    if (!fixed) setDestMode(hasOwnCategories ? "file" : "single");
    setStep("where");
  };

  const goPreview = async () => {
    setError(null);
    try {
      const found = await findDuplicates(prepared.map((r) => r.front));
      setDuplicates(new Set(found));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate check failed");
    }
  };

  const run = async () => {
    setStep("running");
    setProgress(0);
    setError(null);
    try {
      const batchId = await startImport(filename, prepared.length);
      let created = 0;
      let skipped = 0;
      const errors: { line: number; reason: string }[] = [];

      for (let i = 0; i < prepared.length; i += CHUNK) {
        const result = await importRows(batchId, prepared.slice(i, i + CHUNK), strategy);
        created += result.created;
        skipped += result.skipped;
        errors.push(...result.errors);
        setProgress(Math.min(prepared.length, i + CHUNK));
      }

      await finishImport(batchId, { created, skipped, errors: errors.length });
      setReport({ batchId, created, skipped, errors });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setStep("preview");
    }
  };

  const downloadErrors = () => {
    if (!report) return;
    const csv = Papa.unparse(report.errors.map((e) => ({ line: e.line, reason: e.reason })));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-errors.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const revert = async () => {
    if (!report) return;
    const res = await undoImport(report.batchId);
    if (!res.ok) {
      setError(res.error ?? "Could not undo");
      return;
    }
    setReport(null);
    setStep("file");
    setRows([]);
    setPasted("");
  };

  return (
    <div className="mt-6">
      {pickerDialog}
      <Steps current={step} />

      {error && (
        <p role="alert" className="mt-4 rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {step === "file" && (
        <div className="mt-5">
          <div className="flex gap-1 rounded-lg border-control border-field-line bg-surface-2 p-1">
            {(
              [
                ["file", "Upload a file"],
                ["paste", "Paste content"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSource(key);
                  setError(null);
                }}
                aria-pressed={source === key}
                className={`min-h-10 flex-1 rounded-md px-4 text-sm font-semibold ${
                  source === key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {source === "file" ? (
            <div className="mt-4 rounded-lg border-control border-dashed border-line-strong p-6 text-center">
              <input
                id="import-file"
                type="file"
                accept=".csv,.tsv,.txt,.json,text/csv,application/json"
                hidden
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <label
                htmlFor="import-file"
                className={`${buttonClass("primary", "lg")} cursor-pointer`}
              >
                Choose a file
              </label>
              <p className="mt-3 text-sm text-muted">
                CSV separated by comma, semicolon or tab — or a JSON file exported from here.
                UTF-8, with or without BOM.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={10}
                spellCheck={false}
                aria-label="Paste CSV or JSON"
                placeholder={PASTE_EXAMPLE}
                className={`${inputClass} resize-y font-mono text-sm`}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  tone="primary"
                  size="lg"
                  disabled={pasted.trim() === ""}
                  onClick={() => readText(pasted, "pasted content")}
                >
                  Read the content
                </Button>
                <p className="text-sm text-muted">
                  CSV or JSON — the format is detected on its own.
                </p>
              </div>
            </div>
          )}

          {/*
            Граница названа на экране, а не спрятана в документации: импорт
            JSON восстанавливает карточки, темы и теги, но НЕ расписание.
            Иначе одно неосторожное восстановление обнулило бы месяцы работы
            алгоритма над существующими карточками.
          */}
          <p className="mt-4 text-sm text-muted">
            A JSON export brings back cards, decks and tags — but not the schedule or the review
            history. Existing cards keep the progress they have earned.
          </p>
        </div>
      )}

      {step === "map" && (
        <div className="mt-5">
          <p className="text-sm text-muted">
            {rows.length} rows, {headers.length} columns. Known names are matched automatically.
          </p>
          {fromExport && (
            /* Шаг сопоставления не пропускаем даже здесь: мастер обещает, что
               ничего не запишется, пока вы не увидите предпросмотр, и своя же
               выгрузка — не повод обещание нарушить */
            <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
              This is an export from Memorizer — every column matched. Press Preview to check what
              will be created.
            </p>
          )}
          <ul className="mt-4 flex flex-col gap-2">
            {FIELDS.map((field) => (
              <li key={field.key} className="grid items-center gap-2 sm:grid-cols-[170px_1fr]">
                {/* Подпись примитивом дизайн-системы: звёздочка обязательности
                    и подсказка — её свойства, а не вторая строка классов. */}
                <label htmlFor={`map-${field.key}`}>
                  <FieldLabel required={field.required} hint={field.hint}>
                    {field.label}
                  </FieldLabel>
                </label>
                <select
                  id={`map-${field.key}`}
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">— do not import —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <Button tone="primary" onClick={goWhere} disabled={!mapping.front || !mapping.back}>
              Next
            </Button>
            <Button onClick={() => setStep("file")}>Back</Button>
          </div>
        </div>
      )}

      {step === "where" && (
        <div className="mt-5">
          <p className="text-sm text-muted">
            A card lives inside a set, and a set lives inside a category. This is where these{" "}
            {prepared.length} cards land.
          </p>

          {fixed ? (
            /* Пришли из категории — назначение уже известно. Показываем его
               как факт, а не как вопрос: выбирать тут не из чего. */
            <div className="mt-4 rounded-xl border-control border-field-line bg-surface p-4">
              <span className="label-micro">Category</span>
              <p className="mt-1 text-lg font-semibold text-accent">{fixed.name}</p>
              <p className="mt-1 text-sm text-muted">
                Started from this category, so everything lands here. Sets come from the Set
                column; rows without one go into “{fallbackDeck}”.
              </p>
            </div>
          ) : (
          <div className="mt-4 flex flex-col gap-3">
            {/* Свои категории предлагаем, только если они в файле правда есть:
                иначе выбор оставил бы темы в корне, без категории вовсе. */}
            <label
              className={`flex gap-3 rounded-xl border-control p-4 ${
                destMode === "file"
                  ? "border-accent bg-accent-soft"
                  : "border-field-line bg-surface"
              } ${hasOwnCategories ? "cursor-pointer" : "cursor-not-allowed opacity-55"}`}
            >
              <input
                type="radio"
                name="dest"
                className="mt-1 accent-[var(--accent)]"
                checked={destMode === "file"}
                disabled={!hasOwnCategories}
                onChange={() => setDestMode("file")}
              />
              <span className="min-w-0">
                <span className="block font-semibold">Keep the categories from the file</span>
                <span className="mt-1 block text-sm text-muted">
                  {hasOwnCategories
                    ? "The topic column already carries a “Category / Topic” path. Missing ones are created."
                    : "Not available: no row in this file names a category."}
                </span>
              </span>
            </label>

            <label
              className={`flex gap-3 rounded-xl border-control p-4 ${
                destMode === "single"
                  ? "border-accent bg-accent-soft"
                  : "border-field-line bg-surface"
              } cursor-pointer`}
            >
              <input
                type="radio"
                name="dest"
                className="mt-1 accent-[var(--accent)]"
                checked={destMode === "single"}
                onChange={() => setDestMode("single")}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Put everything in one category</span>
                <span className="mt-1 block text-sm text-muted">
                  Topic names from the file are kept; only the category is replaced.
                </span>

                {destMode === "single" && (
                  <span className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={chooseCategory}>
                      {category ? "Change category" : "Choose category"}
                    </Button>
                    <span className="text-sm">
                      {category ? (
                        <b className="font-semibold text-accent">{category.name}</b>
                      ) : (
                        <span className="text-faint">nothing chosen yet</span>
                      )}
                    </span>
                  </span>
                )}
              </span>
            </label>
          </div>

          )}

          {/* Строки без набора: класть карточку прямо в категорию база не даст */}
          {destMode === "single" && rowsWithoutTopic > 0 && (
            <div className="mt-4 rounded-xl border-control border-field-line bg-surface p-4">
              <label htmlFor="fallback-deck" className="block text-sm font-semibold">
                {rowsWithoutTopic} {rowsWithoutTopic === 1 ? "row has" : "rows have"} no topic
              </label>
              <p className="mt-1 text-sm text-muted">
                A card cannot sit in a category directly, so those go into a topic of this name.
              </p>
              <input
                id="fallback-deck"
                value={fallbackDeck}
                onChange={(e) => setFallbackDeck(e.target.value)}
                className={`${inputClass} mt-2`}
              />
            </div>
          )}

          {/* Итог до записи: видно каждый адрес и сколько карточек в него идёт */}
          {destinationReady && (
            <div className="mt-5">
              <h3 className="label-micro">
                {destinations.length} {destinations.length === 1 ? "destination" : "destinations"}
              </h3>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {destinations.slice(0, 12).map(([path, count]) => (
                  <li key={path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{path}</span>
                    <span className="shrink-0 tabular-nums text-muted">{count}</span>
                  </li>
                ))}
              </ul>
              {destinations.length > 12 && (
                <p className="mt-2 text-xs text-faint">
                  and {destinations.length - 12} more
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <Button tone="primary" onClick={goPreview} disabled={!destinationReady}>
              Preview
            </Button>
            <Button onClick={() => setStep("map")}>Back</Button>
          </div>
          {!destinationReady && (
            <p className="mt-2 text-sm text-muted">
              Choose a category before going on — that is where these cards will live.
            </p>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="mt-5">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-4">
            {[
              { label: "Rows", value: prepared.length },
              { label: "Duplicates", value: dupCount },
              { label: "Invalid", value: invalid },
              { label: "Topics used", value: newTopics.length },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3">
                <dt className="label-micro">{s.label}</dt>
                <dd className="mt-1 text-xl font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          {dupCount > 0 && (
            <fieldset className="mt-4 rounded border border-line p-3">
              <legend className="px-1 label-micro">
                What to do with duplicates
              </legend>
              {(
                [
                  ["skip", "Skip them"],
                  ["update", "Update the existing card"],
                  ["create", "Create anyway"],
                ] as [DuplicateStrategy, string][]
              ).map(([value, label]) => (
                <label key={value} className="mr-4 inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="dup"
                    checked={strategy === value}
                    onChange={() => setStrategy(value)}
                    className="accent-[var(--accent)]"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}

          <h3 className="mt-6 label-micro">
            First {Math.min(PREVIEW, prepared.length)} cards
          </h3>
          <ul className="mt-2 divide-y divide-line rounded border border-line bg-surface">
            {prepared.slice(0, PREVIEW).map((row) => (
              <li key={row.line} className="px-4 py-3 text-sm">
                <div className="prose-card" dangerouslySetInnerHTML={{ __html: renderMarkdown(row.front) }} />
                <div
                  className="prose-card mt-1 text-muted"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(row.back) }}
                />
                <p className="mt-1 label-micro">
                  {row.topic || "no set"}
                  {row.source && ` · ${row.source}`}
                  {duplicates.has(normalize(row.front)) && (
                    <span className="text-rust"> · duplicate</span>
                  )}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex gap-2">
            <Button tone="primary" onClick={run}>
              Import {prepared.length - (strategy === "skip" ? dupCount : 0) - invalid} cards
            </Button>
            <Button onClick={() => setStep("where")}>Back</Button>
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="mt-8">
          <p className="text-sm text-muted">
            Importing {progress} of {prepared.length}…
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded bg-surface-2">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${Math.round((progress / Math.max(1, prepared.length)) * 100)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-faint">
            Rows go in batches of {CHUNK}. Do not close the tab.
          </p>
        </div>
      )}

      {step === "done" && report && (
        <div className="mt-6">
          <h2 className="font-display text-2xl font-semibold">Import finished</h2>

          {/* Главное в итоге — не число, а адрес: куда это всё легло. Без него
              «12 cards imported» оставляет искать их по всему приложению. */}
          {report.created > 0 && (
            <p className="mt-2 text-base">
              <b className="font-semibold tabular-nums">{report.created}</b>{" "}
              {report.created === 1 ? "card" : "cards"} went into{" "}
              {destinations.length === 1 ? (
                <b className="font-semibold text-accent">{destinations[0][0]}</b>
              ) : (
                <>
                  <b className="font-semibold text-accent">{destinations.length} topics</b>
                  {category && (
                    <>
                      {" "}inside <b className="font-semibold text-accent">{category.name}</b>
                    </>
                  )}
                </>
              )}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
            {[
              { label: "Created", value: report.created },
              { label: "Skipped", value: report.skipped },
              { label: "Errors", value: report.errors.length },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3">
                <dt className="label-micro">{s.label}</dt>
                <dd className="mt-1 text-xl font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          {report.created > 0 && destinations.length > 0 && (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {destinations.slice(0, 12).map(([path, count]) => (
                <li key={path} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{path}</span>
                  <span className="shrink-0 tabular-nums text-muted">{count}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {/* Ведём в саму категорию, когда она известна: там карточки и лежат.
                Библиотека — запасной адрес, когда категорий в импорте несколько. */}
            <LinkButton
              href={category ? `/knowledge/${category.id}` : "/library"}
              tone="primary"
            >
              {category ? `Open ${category.name}` : "Open library"}
            </LinkButton>
            {report.errors.length > 0 && (
              <Button onClick={downloadErrors}>Download error report</Button>
            )}
            <Button tone="danger" onClick={revert}>
              Undo this import
            </Button>
          </div>
          <p className="mt-3 text-xs text-faint">
            An import can be undone within 24 hours — the cards it created are removed for good.
          </p>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: Step[] = ["file", "map", "where", "preview", "done"];
  const labels: Record<Step, string> = {
    file: "File",
    map: "Columns",
    where: "Category",
    preview: "Preview",
    running: "Preview",
    done: "Result",
  };
  const activeIndex = order.indexOf(current === "running" ? "preview" : current);

  return (
    <ol className="flex flex-wrap gap-2 label-micro">
      {order.map((step, i) => (
        <li
          key={step}
          className={`rounded px-2.5 py-1 ${
            i === activeIndex
              ? "bg-accent text-accent-ink"
              : i < activeIndex
                ? "bg-accent-soft text-accent"
                : "bg-surface-2 text-faint"
          }`}
        >
          {i + 1}. {labels[step]}
        </li>
      ))}
    </ol>
  );
}
