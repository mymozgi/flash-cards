"use client";

import Link from "next/link";

/**
 * Граница ошибок для всего приложения.
 *
 * Появилась после случая, когда выборка очереди падала из-за непринятой
 * миграции, а пользователь видел «всё выучено». Отказ должен выглядеть
 * как отказ и называть причину.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const looksLikeSchemaDrift =
    error.message.includes("schema cache") || error.message.includes("column");

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 rounded-lg bg-rust-soft px-4 py-3 text-left text-sm text-rust">
        {error.message}
      </p>

      {looksLikeSchemaDrift && (
        <p className="mt-3 text-sm text-muted">
          This usually means the database is missing a migration. Apply the pending files from
          <code className="mx-1 rounded bg-surface-2 px-1.5 py-0.5">supabase/migrations/</code>
          in the Supabase SQL editor, then reload.
        </p>
      )}

      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-line px-5 py-2.5 text-sm text-muted">
          Back to Today
        </Link>
      </div>
    </div>
  );
}
