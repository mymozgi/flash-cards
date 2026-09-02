import { classify } from "@/lib/knowledge-tree";

/**
 * Системная классификация карточки: область и тема.
 *
 * Это не теги. Теги ставит человек, и их сколько угодно; эти две подписи
 * ставит структура, и они всегда ровно там, где карточка лежит. Поэтому
 * править их из карточки нельзя — меняют не подпись, а место.
 *
 * Категория весомее темы и показана заливкой, тема — обводкой. Разница в весе
 * не украшение: она отвечает на вопрос «что это за область» раньше, чем на
 * вопрос «какой именно раздел», и порядок чтения должен совпадать с порядком
 * важности.
 *
 * Значение выводится из пути узла и нигде не хранится копией: копия имени
 * категории внутри карточки разошлась бы с деревом при первом переименовании.
 */
export function Classification({
  path,
  className = "",
}: {
  /** Полный путь узла, «Medicine / Pharmacology». */
  path: string | null | undefined;
  className?: string;
}) {
  const { category, topic } = classify(path);
  if (!category) return null;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-0.5 text-2xs font-semibold text-accent">
        {category}
      </span>
      {topic && (
        <span className="inline-flex items-center rounded-full border-control border-line-strong px-2.5 py-0.5 text-2xs font-medium text-muted">
          {topic}
        </span>
      )}
    </span>
  );
}
