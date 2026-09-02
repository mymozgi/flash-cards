"use client";

import { Button, LinkButton, buttonClass } from "@/components/ui/button";
import { inputClass, selectClass } from "@/components/ui/field";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import {
  ImportFormatError,
  parseJson,
  preview as echo,
  sniffFormat,
  type Table,
} from "@/lib/import-format";
import {
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
const TRUTHY = new Set(["1", "true", "yes", "y", "да"]);

const PASTE_EXAMPLE = `front,back,topic,tags
mitochondrion,powerhouse of the cell,Biology / Cells,biology organelles`;

type Field =
  | "front"
  | "back"
  | "topic"
  | "tags"
  | "note"
  | "reversed"
  | "choice1"
  | "choice2"
  | "choice3";

const FIELDS: { key: Field; label: string; required?: boolean; hint: string }[] = [
  { key: "front", label: "Question", required: true, hint: "front side" },
  { key: "back", label: "Answer", required: true, hint: "back side" },
  { key: "topic", label: "Topic", hint: "path separated by /, levels are created as needed" },
  { key: "tags", label: "Tags", hint: "comma or space separated" },
  { key: "note", label: "Note", hint: "shown after the answer" },
  { key: "reversed", label: "Reversed", hint: "1 / true / yes — also create the reverse card" },
  { key: "choice1", label: "Wrong answer 1", hint: "for multiple choice" },
  { key: "choice2", label: "Wrong answer 2", hint: "" },
  { key: "choice3", label: "Wrong answer 3", hint: "" },
];

/** Заголовки в чужих файлах называются как угодно — угадываем самые частые. */
const ALIASES: Record<Field, string[]> = {
  front: ["front", "question", "term", "word", "prompt", "q", "вопрос", "термин"],
  back: ["back", "answer", "definition", "translation", "meaning", "a", "ответ", "перевод"],
  topic: ["topic", "deck", "category", "subject", "тема", "категория"],
  tags: ["tags", "tag", "labels", "теги", "тег"],
  note: ["note", "notes", "comment", "hint", "source", "заметка"],
  reversed: ["reversed", "reverse", "both", "bidirectional", "обратная"],
  choice1: ["choice1", "wrong1", "distractor1", "option1"],
  choice2: ["choice2", "wrong2", "distractor2", "option2"],
  choice3: ["choice3", "wrong3", "distractor3", "option3"],
};

type Step = "file" | "map" | "preview" | "running" | "done";
/** Откуда взялись данные: файл с диска или вставленный текст. */
type Source = "file" | "paste";
type Row = Record<string, string>;

export function ImportWizard() {
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
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    batchId: string;
    created: number;
    skipped: number;
    errors: { line: number; reason: string }[];
  } | null>(null);

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
    topic: mapping.topic ? (raw[mapping.topic] ?? "") : "",
    tags: mapping.tags ? (raw[mapping.tags] ?? "") : "",
    note: mapping.note ? (raw[mapping.note] ?? "") : "",
    reversed: mapping.reversed ? TRUTHY.has((raw[mapping.reversed] ?? "").trim().toLowerCase()) : false,
    choices: [mapping.choice1, mapping.choice2, mapping.choice3]
      .filter(Boolean)
      .map((col) => raw[col] ?? ""),
  });

  const prepared = useMemo(
    () => (mapping.front && mapping.back ? rows.map(toRow) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mapping],
  );

  const invalid = prepared.filter((r) => !r.front.trim() || !r.back.trim()).length;
  const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const dupCount = prepared.filter((r) => duplicates.has(normalize(r.front))).length;
  const newTopics = useMemo(() => {
    const set = new Set(prepared.map((r) => r.topic.trim()).filter(Boolean));
    return [...set];
  }, [prepared]);

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
                <label htmlFor={`map-${field.key}`} className="text-sm">
                  {field.label}
                  {field.required && <span className="text-rust"> *</span>}
                  {field.hint && <span className="block text-xs text-faint">{field.hint}</span>}
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
            <Button tone="primary" onClick={goPreview} disabled={!mapping.front || !mapping.back}>
              Preview
            </Button>
            <Button onClick={() => setStep("file")}>Back</Button>
          </div>
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
                  {row.topic || "no topic"}
                  {row.tags && ` · ${row.tags}`}
                  {row.reversed && " · reversed"}
                  {row.choices.filter(Boolean).length > 0 &&
                    ` · ${row.choices.filter(Boolean).length} wrong answers`}
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
            <Button onClick={() => setStep("map")}>Back</Button>
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

          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton href="/library" tone="primary">
              Open library
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
  const order: Step[] = ["file", "map", "preview", "done"];
  const labels: Record<Step, string> = {
    file: "File",
    map: "Columns",
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
