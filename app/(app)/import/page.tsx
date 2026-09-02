import { ImportWizard } from "./import-wizard";
import { buttonClass } from "@/components/ui/button";

export default function ImportPage() {
  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Import</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Turn a spreadsheet into a deck. Nothing is written until you have seen the preview, and
          any import can be undone within 24 hours.
        </p>
      </header>
      <ImportWizard />

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="label-micro">Export</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Your data should never be locked inside the app. CSV matches the import format above;
          JSON also carries the schedule and the full review history.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Обычная ссылка, а не LinkButton: маршрут отдаёт файл, и next/link
              перехватил бы навигацию вместо скачивания */}
          <a href="/api/export?format=csv" className={buttonClass()}>
            Download CSV
          </a>
          <a href="/api/export?format=json" className={buttonClass()}>
            Download JSON
          </a>
        </div>
      </section>
    </>
  );
}
