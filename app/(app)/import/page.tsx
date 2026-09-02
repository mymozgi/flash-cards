import { ImportWizard } from "./import-wizard";
import { buttonClass } from "@/components/ui/button";

export default function ImportPage() {
  return (
    <>
      <header className="border-b border-line-strong pb-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Import</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Bring cards in from a file or straight from the clipboard — CSV or JSON, the format is
          detected on its own. Nothing is written until you have seen the preview, and any import
          can be undone within 24 hours.
        </p>
      </header>
      <ImportWizard />

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="label-micro">Export</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Your data should never be locked inside the app. Both formats can be read back in above.
          CSV matches the import columns; JSON also carries the schedule and the full review
          history — those two are kept for your own records, importing never overwrites the
          progress a card has already earned.
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
