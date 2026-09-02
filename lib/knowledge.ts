import "server-only";
import { createClient } from "./supabase/server";

/**
 * Данные раздела Knowledge.
 *
 * Новой таблицы под категории нет и не нужно: `topics` уже дерево произвольной
 * формы. Здесь только выборка, приспособленная под другой вопрос — не «в какой
 * колоде эта карточка», а «как устроены мои знания».
 */

/**
 * Род узла. Категория держит структуру, группа держит карточки.
 * До миграции 0020 колонки нет — тогда род выводится из данных, как и раньше.
 */
export type NodeKind = "area" | "deck" | "source";

export type KnowledgeNode = {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  color: string;
  icon: string;
  kind: NodeKind;
  archived: boolean;
  position: number;
  depth: number;
  /** Полный путь через « / » — читаемый адрес узла. */
  path: string;
  /** Карточки во всей ветке, а не только в самом узле. */
  cards: number;
  /** Подкатегории во всей ветке. */
  descendants: number;
  /** Прямые дети, в порядке position. */
  children: KnowledgeNode[];
};

type Row = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  kind: NodeKind | null;
  archived_at: string | null;
  position: number;
};

/**
 * До миграции 0015 трёх колонок в таблице нет, и жёсткий запрос обрушил бы весь
 * раздел. Мягкий откат оставляет его рабочим: категории те же, просто без
 * иконок и без архива — ровно то, что «колонок ещё нет» и означает.
 */
const FULL = "id,parent_id,name,description,color,icon,kind,archived_at,position";
const LEGACY = "id,parent_id,name,description,color,position";

export type KnowledgeTree = {
  roots: KnowledgeNode[];
  flat: KnowledgeNode[];
  /** Миграция 0015 не применена: интерфейс прячет то, чего база не умеет. */
  legacy: boolean;
  /**
   * Миграция 0017 не применена, объём ветки неизвестен. Показывать в этом
   * случае нули нельзя: ноль карточек и «мы не смогли посчитать» — разные
   * утверждения, и первое из них враньё.
   */
  countsReady: boolean;
};

export async function getKnowledgeTree({
  includeArchived = false,
}: { includeArchived?: boolean } = {}): Promise<KnowledgeTree> {
  const supabase = await createClient();

  const full = await supabase.from("topics").select(FULL).order("position").order("name");
  const legacy = Boolean(full.error);
  const result = legacy
    ? await supabase.from("topics").select(LEGACY).order("position").order("name")
    : full;

  if (result.error) {
    // Отказ должен называть причину: пустой экран выглядит как «ничего нет»
    throw new Error(`Could not load the knowledge tree: ${result.error.message}`);
  }

  const rollup = await supabase.from("topic_rollup").select("topic_id,cards,descendants");
  const countsReady = !rollup.error;
  const counts = new Map<string, { cards: number; descendants: number }>(
    ((rollup.data ?? []) as { topic_id: string; cards: number; descendants: number }[]).map(
      (row) => [row.topic_id, { cards: row.cards, descendants: row.descendants }],
    ),
  );

  const rows = (result.data ?? []) as Row[];
  const byParent = new Map<string | null, Row[]>();
  for (const row of rows) {
    const list = byParent.get(row.parent_id) ?? [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }

  const flat: KnowledgeNode[] = [];

  const build = (parentId: string | null, prefix: string, depth: number): KnowledgeNode[] => {
    const list = byParent.get(parentId) ?? [];
    const out: KnowledgeNode[] = [];

    for (const row of list) {
      const archived = Boolean(row.archived_at);
      if (archived && !includeArchived) continue;

      const path = prefix ? `${prefix} / ${row.name}` : row.name;
      const stats = counts.get(row.id);
      const node: KnowledgeNode = {
        id: row.id,
        parentId: row.parent_id,
        name: row.name,
        description: row.description ?? "",
        color: row.color ?? "",
        icon: row.icon ?? "",
        kind: row.kind ?? "area",
        archived,
        position: row.position,
        depth,
        path,
        cards: stats?.cards ?? 0,
        descendants: stats?.descendants ?? 0,
        children: [],
      };
      // Родитель попадает в плоский список раньше своих детей: этот порядок и
      // есть порядок строк на экране «Manage», где дерево показано сплошняком
      out.push(node);
      flat.push(node);
      node.children = build(row.id, path, depth + 1);
    }
    return out;
  };

  const roots = build(null, "", 0);
  return { roots, flat, legacy, countsReady };
}
