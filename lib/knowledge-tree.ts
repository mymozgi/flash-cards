/**
 * Правила связей в дереве категорий.
 *
 * Вынесено из компонентов не ради порядка: пока «куда встанет узел» считалось
 * внутри обработчика перетаскивания, проверить это можно было только рукой и
 * только на живой базе. А ошибка здесь тихая — узел уезжает не туда, порядок
 * братьев съезжает на единицу, и заметить это можно через неделю.
 *
 * Здесь только чистые функции над плоским списком узлов. Ни запросов, ни React.
 */

export type TreeNode = {
  id: string;
  parentId: string | null;
  /** Порядок среди братьев. */
  position?: number;
};

export type DropZone = "before" | "after" | "inside";

/** Куда встанет узел и в каком порядке окажутся его новые братья. */
export type Placement = { parentId: string | null; siblings: string[] };

/** Сам узел и всё, что под ним. Именно эти узлы не могут стать его родителем. */
export function branchOf<T extends TreeNode>(nodes: T[], id: string): Set<string> {
  const childrenOf = new Map<string | null, string[]>();
  for (const node of nodes) {
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node.id);
    childrenOf.set(node.parentId, list);
  }

  const out = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (out.has(current)) continue; // защита от уже испорченного дерева с петлёй
    out.add(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }
  return out;
}

/**
 * Можно ли уронить `dragId` на `targetId` в такой зоне.
 *
 * Вложить узел в самого себя или в собственного потомка нельзя — это петля,
 * и база такую перестановку отклонит. А вот встать рядом с потомком можно:
 * это выносит узел из ветки наверх, и ничего циклического в нём нет.
 */
export function canDrop<T extends TreeNode>(
  nodes: T[],
  dragId: string,
  targetId: string,
  zone: DropZone,
): boolean {
  if (dragId === targetId) return false;
  const branch = branchOf(nodes, dragId);
  if (zone === "inside") return !branch.has(targetId);

  const target = nodes.find((node) => node.id === targetId);
  if (!target) return false;
  // встать рядом с собственным потомком значит переехать под него же —
  // это та же петля, только выраженная иначе
  return !branch.has(target.parentId ?? "");
}

/**
 * Новый родитель и порядок братьев после сброса.
 *
 * Порядок возвращается целиком, а не «позицией узла»: `position` — это место
 * среди братьев, и если переписать его только у переехавшего, два узла получат
 * одинаковое число, а дальше порядок будет зависеть от того, как база вернула
 * строки.
 */
export function placeAfterDrop<T extends TreeNode>(
  nodes: T[],
  dragId: string,
  targetId: string,
  zone: DropZone,
): Placement | null {
  if (!canDrop(nodes, dragId, targetId, zone)) return null;

  const target = nodes.find((node) => node.id === targetId);
  if (!target) return null;

  const parentId = zone === "inside" ? target.id : target.parentId;

  const siblings = nodes
    .filter((node) => node.parentId === parentId && node.id !== dragId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((node) => node.id);

  if (zone === "inside") {
    // внутрь — в конец: новый ребёнок дописывается, а не втискивается в начало
    siblings.push(dragId);
    return { parentId, siblings };
  }

  const at = siblings.indexOf(targetId);
  if (at < 0) return null;
  siblings.splice(zone === "before" ? at : at + 1, 0, dragId);
  return { parentId, siblings };
}

/** Рёбра иерархии: по одному на каждую пару «родитель — ребёнок». */
export function hierarchyEdges<T extends TreeNode>(
  nodes: T[],
): { id: string; source: string; target: string }[] {
  const known = new Set(nodes.map((node) => node.id));
  return nodes
    .filter((node) => node.parentId !== null && known.has(node.parentId))
    .map((node) => ({
      id: `h:${node.parentId}:${node.id}`,
      source: node.parentId as string,
      target: node.id,
    }));
}

/** Глубина узла. `Infinity` — дерево испорчено петлёй. */
export function depthOf<T extends TreeNode>(nodes: T[], id: string): number {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let depth = 0;
  let current = byId.get(id)?.parentId ?? null;

  while (current !== null) {
    if (seen.has(current)) return Infinity;
    seen.add(current);
    depth += 1;
    current = byId.get(current)?.parentId ?? null;
  }
  return depth;
}

/**
 * Набор ли это, который можно учить.
 *
 * Узел дерева бывает двух родов, и различает их один признак: есть ли у него
 * собственные карточки. «Psychology» с тремя подкатегориями и без своих
 * карточек — контейнер: открывать в нём сессию повторения не в чем, кнопка
 * Practice там обещает то, чего нет.
 *
 * Пустой лист при этом остаётся набором: категорию только что создали и вот-вот
 * наполнят, и прятать её из списка значило бы терять то, что человек сам
 * секунду назад сделал.
 */
export function isStudySet(node: {
  ownCards: number;
  hasChildren: boolean;
  /** Явный род. Учитывается, только когда разделение уже введено. */
  kind?: string | null;
}): boolean {
  // Явное намерение сильнее догадки по данным: пустая группа остаётся группой,
  // а категория не становится колодой оттого, что кто-то положил в неё карточку
  if (node.kind === "deck") return true;
  if (node.kind === "area" || node.kind === "source") return false;
  return node.ownCards > 0 || !node.hasChildren;
}

/**
 * Введено ли разделение на роды в этой базе.
 *
 * Вопрос не праздный, и он оплачен поломкой. Миграция 0015 добавляет колонку
 * рода со значением по умолчанию `area` — то есть сразу после неё КАЖДЫЙ узел
 * числится категорией. Перевод в `deck` делает следующая миграция, и между
 * ними база находится в состоянии «колод нет ни одной». Код, читающий род
 * буквально, в этот промежуток прятал из списка вообще всё.
 *
 * Признак того, что разделение действует, — существование хотя бы одной
 * группы. Пока её нет, род ничего не различает, и работает прежняя догадка
 * по данным. Как только перенос выполнен, правило включается само.
 */
export function kindInEffect(kinds: (string | null | undefined)[]): boolean {
  return kinds.some((kind) => kind === "deck");
}
