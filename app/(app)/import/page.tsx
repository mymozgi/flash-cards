import { ImportWizard } from "./import-wizard";
import { buttonClass } from "@/components/ui/button";
import { getTopicTree } from "@/lib/data";

export default async function ImportPage() {
  /*
    Только верхний уровень: по форме дерева категория — это узел без родителя,
    и именно из них выбирают, куда лягут карточки. Набор в список не попадает —
    выбирают категорию, а тему внутри неё даёт сам файл.
  */
  const categories = (await getTopicTree())
    .filter((node) => node.depth === 0)
    .map((node) => ({
      id: node.id,
      name: node.name,
      path: node.path,
      icon: node.icon ?? undefined,
      color: node.color ?? undefined,
    }));

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
      <ImportWizard categories={categories} />

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
