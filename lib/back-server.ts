import "server-only";
import { getTopicTree } from "./data";
import {
  originFallbackLabel,
  originHref,
  parseOrigin,
  type Origin,
} from "./back";

export type Back = { href: string; label: string };

/**
 * Куда ведёт «назад» и как это назвать.
 *
 * Имя берётся из живого дерева по идентификатору, а не из адреса: иначе
 * переименованная категория показывалась бы старым именем до следующего
 * перехода, а удалённая — именем несуществующего узла.
 *
 * Дерево запрашивается, только если происхождение правда указывает на узел.
 * Возврат в «Knowledge» или «All sets» лишнего запроса не стоит.
 */
export async function resolveBack(
  from: string | null | undefined,
  fallback: Back,
): Promise<Back> {
  const origin = parseOrigin(from);
  if (!origin) return fallback;

  const href = originHref(origin);
  const named = origin.kind === "category" || origin.kind === "set";
  if (!named) return { href, label: originFallbackLabel(origin) };

  const id = (origin as Extract<Origin, { id: string }>).id;
  const node = (await getTopicTree()).find((topic) => topic.id === id);
  // Узел мог исчезнуть, пока человек ходил по приложению: ведём туда же,
  // но не выдумываем имя
  return { href, label: node?.name ?? originFallbackLabel(origin) };
}
