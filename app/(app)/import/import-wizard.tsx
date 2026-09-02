"use client";

import { Button, LinkButton, buttonClass } from "@/components/ui/button";
import { selectClass } from "@/components/ui/field";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
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
type Row = Record<string, string>;

export function ImportWizard() {
  const [step, setStep] = useState<Step>("file");
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

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (result) => {
        const parsed = result.data.filter((r) => Object.values(r).some((v) => v?.trim()));
        if (parsed.length === 0) {
          setError("No data rows found. Check that the first line contains column names.");
          return;
        }
        const cols = (result.meta.fields ?? []).filter(Boolean);
        const guess = {} as Record<Field, string>;
        for (const { key } of FIELDS) {
          const hit = cols.find((c) => ALIASES[key].includes(c.toLowerCase()));
          if (hit) guess[key] = hit;
        }
        setFilename(file.name);
        setHeaders(cols);
        setRows(parsed.slice(0, MAX_ROWS));
        setMapping(guess);
        setStep("map");
        if (parsed.length > MAX_ROWS) {
          setError(`The file has ${parsed.length} rows; only the first ${MAX_ROWS} will be imported.`);
        }
      },
      error: (e) => setError(`Could not read the file: ${e.message}`),
    });
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
        <div className="mt-5 rounded border border-dashed border-line p-6 text-center">
          <input
            id="csv"
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <label htmlFor="csv" className={`${buttonClass("primary", "lg")} cursor-pointer`}>
            Choose a CSV file
          </label>
          <p className="mt-3 text-sm text-muted">
            Comma, semicolon or tab separated. UTF-8, with or without BOM. The first line must
            contain column names.
          </p>
        </div>
      )}

      {step === "map" && (
        <div className="mt-5">
          <p className="text-sm text-muted">
            {rows.length} rows, {headers.length} columns. Known names are matched automatically.
          </p>
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
