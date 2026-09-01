"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

const initial: SettingsState = { error: null };

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
        hint="The daily intake. 0 means no limit. Lower is safer — every new card becomes a review debt tomorrow."
      >
        <input
          name="daily_new_limit"
          type="number"
          min={0}
          max={500}
          defaultValue={settings.daily_new_limit}
          className={inputClass}
        />
      </Field>

      <Field label="Reviews per day" hint="A ceiling for the scheduled queue, not a goal. 0 means no limit — Practice ignores it either way.">
        <input
          name="daily_review_limit"
          type="number"
          min={0}
          max={5000}
          defaultValue={settings.daily_review_limit}
          className={inputClass}
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
          className={inputClass}
        />
      </Field>

      <Field label="Time zone" hint="Decides when the daily counters reset. IANA name, e.g. Europe/Kyiv.">
        <input name="timezone" defaultValue={settings.timezone} className={inputClass} />
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

      <Button type="submit" tone="primary" size="lg" loading={pending} className="self-start">
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

