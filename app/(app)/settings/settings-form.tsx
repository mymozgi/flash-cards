"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "./actions";

const initial: SettingsState = { error: null };
const FIELD =
  "w-full rounded-lg border border-transparent bg-surface-2 px-3 py-2 text-sm focus:border-line focus:bg-surface";

export function SettingsForm({
  settings,
}: {
  settings: {
    daily_new_limit: number;
    daily_review_limit: number;
    request_retention: number;
    timezone: string;
    mcq_enabled: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(saveSettings, initial);

  return (
    <form action={formAction} className="mt-5 flex max-w-lg flex-col gap-4">
      <Field
        label="New cards per day"
        hint="The daily intake. Lower is safer — every new card becomes a review debt."
      >
        <input
          name="daily_new_limit"
          type="number"
          min={0}
          max={500}
          defaultValue={settings.daily_new_limit}
          className={FIELD}
        />
      </Field>

      <Field label="Reviews per day" hint="A ceiling for the queue, not a goal.">
        <input
          name="daily_review_limit"
          type="number"
          min={1}
          max={2000}
          defaultValue={settings.daily_review_limit}
          className={FIELD}
        />
      </Field>

      <Field
        label="Retention target"
        hint="The chance of recall FSRS aims for at review time. 0.90 is the sweet spot: higher means more reviews, lower means more forgetting."
      >
        <input
          name="request_retention"
          type="number"
          step="0.01"
          min={0.7}
          max={0.98}
          defaultValue={settings.request_retention}
          className={FIELD}
        />
      </Field>

      <Field label="Time zone" hint="Decides when the daily counters reset. IANA name, e.g. Europe/Kyiv.">
        <input name="timezone" defaultValue={settings.timezone} className={FIELD} />
      </Field>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="mcq_enabled"
          defaultChecked={settings.mcq_enabled}
          className="size-4 accent-[var(--accent)]"
        />
        Turn on multiple choice for new cards by default
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-rust-soft px-3 py-2 text-sm text-rust">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          Saved
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      <span className="text-xs text-faint">{hint}</span>
    </label>
  );
}
