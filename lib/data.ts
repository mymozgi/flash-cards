import "server-only";
import { createClient, requireUser } from "./supabase/server";
import { startOfDay } from "./day";
import { publicUrl } from "./storage";
import { isMissingColumn, rememberSourceColumn, withSource } from "./schema";
import { isStudySet } from "./knowledge-tree";
import { toSlot } from "./tag-color";
import type {
  CardRow,
  CardTag,
  DeckSummary,
  MediaItem,
  QueueCard,
  SchedulingRow,
  SettingsRow,
  TagRow,
  TopicNode,
  TopicRow,
} from "./types";

const SCHEDULING_FIELDS =
  "card_id,state,due,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,last_review";
const CARD_FIELDS =
  "id,topic_id,front_md,back_md,note_md,kind,shape,layout,image_position,suspended,created_at,updated_at";

export async function getSettings(): Promise<SettingsRow> {
  const supabase = await createClient();
  const user = await requireUser();

  const { data } = await supabase
    .from("settings")
    .select("daily_new_limit,daily_review_limit,request_retention,timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return data as SettingsRow;

  const defaults: SettingsRow = {
    daily_new_limit: 20,
    daily_review_limit: 150,
    request_retention: 0.9,
    timezone: "UTC",
  };
  await supabase.from("settings").insert({ user_id: user.id, ...defaults });
  return defaults;
}

export async function getTopicTree(): Promise<TopicNode[]> {
  const supabase = await createClient();

  const [{ data: topics }, { data: counts }] = await Promise.all([
    supabase
      .from("topics")
      .select("id,parent_id,name,position,description,color,image_path")
      .order("position")
      .order("name"),
    supabase.from("topic_card_counts").select("topic_id,card_count"),
  ]);

  const rows = (topics ?? []) as TopicRow[];
  const countBy = new Map<string, number>(
    (counts ?? []).map((c: { topic_id: string | null; card_count: number }) => [
      c.topic_id ?? "",
      c.card_count,
    ]),
  );

  const byParent = new Map<string | null, TopicRow[]>();
  for (const row of rows) {
    const list = byParent.get(row.parent_id) ?? [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }

  const out: TopicNode[] = [];
  const walk = (parent: string | null, prefix: string, depth: number) => {
    for (const row of byParent.get(parent) ?? []) {
      const path = prefix ? `${prefix} / ${row.name}` : row.name;
      out.push({ ...row, path, depth, cardCount: countBy.get(row.id) ?? 0 });
      walk(row.id, path, depth + 1);
    }
  };
  walk(null, "", 0);
  return out;
}

/**
 * Сводка по каждому набору: сколько карточек, сколько выучено, когда
 * повторяли. Считает представление topic_progress — тянуть все карточки
 * на клиент ради трёх чисел было бы расточительно.
 */
export async function getDeckSummaries(): Promise<DeckSummary[]> {
  const supabase = await createClient();
  const [topics, { data: progress }] = await Promise.all([
    getTopicTree(),
    supabase.from("topic_progress").select("topic_id,total,memorized,last_used"),
  ]);

  const stats = new Map(
    ((progress ?? []) as { topic_id: string | null; total: number; memorized: number; last_used: string | null }[])
      .filter((row) => row.topic_id)
      .map((row) => [row.topic_id as string, row]),
  );
  const byId = new Map(topics.map((t) => [t.id, t]));
  const hasChildren = new Set(topics.map((t) => t.parent_id).filter(Boolean) as string[]);

  /** Цепочка предков снизу вверх, с защитой от испорченного петлёй дерева. */
  const ancestorsOf = (id: string): string[] => {
    const chain: string[] = [];
    const seen = new Set<string>([id]);
    let parentId = byId.get(id)?.parent_id ?? null;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      chain.unshift(parentId);
      parentId = byId.get(parentId)?.parent_id ?? null;
    }
    return chain;
  };

  /*
    Контейнеры сюда не попадают. Узел с подкатегориями и без собственных
    карточек — не набор: учить в нём нечего, а кнопка Practice обещала бы
    сессию, которой не будет. Такой узел живёт в разделе Categories, где он
    и есть родительская категория, а не колода.

    Отбор стоит здесь, а не в двух экранах: «Сегодня» и «My flashcards»
    задают базе один и тот же вопрос, и разойтись в ответе они не должны.
  */
  return topics
    .filter((topic) =>
      isStudySet({
        ownCards: stats.get(topic.id)?.total ?? 0,
        hasChildren: hasChildren.has(topic.id),
      }),
    )
    .map((topic) => {
    const row = stats.get(topic.id);
    const parent = topic.parent_id ? byId.get(topic.parent_id) : undefined;
    const ancestors = ancestorsOf(topic.id);
    const root = byId.get(ancestors[0] ?? topic.id);
    return {
      id: topic.id,
      name: topic.name,
      description: topic.description ?? "",
      color: topic.color ?? "",
      cover: topic.image_path ? publicUrl(topic.image_path) : "",
      ancestors,
      rootId: root?.id ?? topic.id,
      rootName: root?.name ?? topic.name,
      rootColor: root?.color ?? "",
      category: parent?.name ?? null,
      total: row?.total ?? 0,
      memorized: row?.memorized ?? 0,
      lastUsed: row?.last_used ?? null,
    };
  });
}

export async function getTags(): Promise<TagRow[]> {
  const supabase = await createClient();
  // Цвет тянем отдельной попыткой: до миграции 0014 колонки нет, и жёсткий
  // запрос обрушил бы список тегов целиком
  const withColor = await supabase.from("tags").select("id,name,color").order("name");
  const data = (
    withColor.error
      ? (await supabase.from("tags").select("id,name").order("name")).data
      : withColor.data
  ) as { id: string; name: string; color?: number | null }[] | null;

  return (data ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    slot: toSlot(tag.color),
  }));
}

export type TodayCounts = {
  due: number;
  newAvailable: number;
  reviewsDoneToday: number;
  newDoneToday: number;
  total: number;
};

export async function getTodayCounts(settings: SettingsRow): Promise<TodayCounts> {
  const supabase = await createClient();
  const user = await requireUser();
  const nowIso = new Date().toISOString();
  const dayStart = startOfDay(settings.timezone).toISOString();

  const activeCard = (q: ReturnType<typeof buildQuery>) =>
    q.eq("user_id", user.id).eq("cards.suspended", false).is("cards.deleted_at", null);

  function buildQuery() {
    return supabase.from("scheduling").select("card_id, cards!inner(id)", {
      count: "exact",
      head: true,
    });
  }

  const [dueRes, newRes, reviewsToday, newToday] = await Promise.all([
    activeCard(buildQuery()).neq("state", "new").lte("due", nowIso),
    activeCard(buildQuery()).eq("state", "new"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("reviewed_at", dayStart)
      .neq("state_before->>state", "new"),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("reviewed_at", dayStart)
      .eq("state_before->>state", "new"),
  ]);

  const reviewsDoneToday = reviewsToday.count ?? 0;
  const newDoneToday = newToday.count ?? 0;

  // Ноль в настройках означает «без ограничения»: приложение личное,
  // и упираться в собственный лимит посреди занятия — худшее, что оно может сделать
  const reviewRoom =
    settings.daily_review_limit <= 0
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, settings.daily_review_limit - reviewsDoneToday);
  const newRoom =
    settings.daily_new_limit <= 0
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, settings.daily_new_limit - newDoneToday);

  const due = Math.min(dueRes.count ?? 0, reviewRoom);
  const newAvailable = Math.min(newRes.count ?? 0, newRoom);

  return { due, newAvailable, reviewsDoneToday, newDoneToday, total: due + newAvailable };
}

type SchedulingWithCard = SchedulingRow & { cards: CardRow };

export type QueueOptions = {
  topicIds?: string[];
  tagIds?: string[];
  /** Свободная тренировка: берём карточки независимо от срока (§8.2, FR-53/56). */
  ignoreSchedule?: boolean;
  limit?: number;
};

export async function getQueue(
  settings: SettingsRow,
  options: QueueOptions = {},
): Promise<QueueCard[]> {
  const supabase = await createClient();
  const user = await requireUser();
  const nowIso = new Date().toISOString();
  const counts = await getTodayCounts(settings);

  let cardIdFilter: string[] | null = null;
  if (options.tagIds?.length) {
    const { data } = await supabase
      .from("card_tags")
      .select("card_id")
      .in("tag_id", options.tagIds);
    cardIdFilter = [...new Set((data ?? []).map((r: { card_id: string }) => r.card_id))];
    if (cardIdFilter.length === 0) return [];
  }

  // Source — украшение под карточкой, очередь — суть. Пока миграция 0018 не
  // применена, колонки нет, и запрос с ней отклоняется целиком: экран
  // повторения переставал показывать карточки из-за строчки со ссылкой.
  const base = () => {
    let q = supabase
      .from("scheduling")
      .select(`${SCHEDULING_FIELDS}, cards!inner(${withSource(CARD_FIELDS)})`)
      .eq("user_id", user.id)
      .eq("cards.suspended", false)
      .is("cards.deleted_at", null);
    if (options.topicIds?.length) q = q.in("cards.topic_id", options.topicIds);
    if (cardIdFilter) q = q.in("card_id", cardIdFilter);
    return q;
  };

  const reviewLimit = options.ignoreSchedule ? (options.limit ?? 500) : counts.due;
  const newLimit = options.ignoreSchedule ? 0 : counts.newAvailable;

  const rows: SchedulingWithCard[] = [];

  /**
   * Один запрос с повтором без необязательной колонки.
   *
   * Source — украшение под карточкой, очередь — суть. Пока миграция 0018 не
   * применена, колонки нет, и PostgREST отклоняет запрос целиком: экран
   * повторения переставал показывать карточки из-за строчки со ссылкой.
   */
  const fetchRows = async (
    build: () => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
    what: string,
  ) => {
    let attempt = await build();
    if (attempt.error && isMissingColumn(attempt.error)) {
      rememberSourceColumn(false);
      attempt = await build();
    } else if (!attempt.error) {
      rememberSourceColumn(true);
    }
    // Молча вернуть пустую очередь — худший вид отказа: выглядит как «всё выучено»
    if (attempt.error) throw new Error(`${what}: ${attempt.error.message}`);
    rows.push(...((attempt.data ?? []) as unknown as SchedulingWithCard[]));
  };

  if (reviewLimit > 0) {
    await fetchRows(() => {
      const q = base().neq("state", "new").order("due", { ascending: true });
      return (options.ignoreSchedule ? q : q.lte("due", nowIso)).limit(reviewLimit);
    }, "Could not build the queue");
  }

  const newRoom = options.ignoreSchedule
    ? (options.limit ?? 100) - rows.length
    : Math.min(newLimit, 500);

  if (newRoom > 0) {
    await fetchRows(
      () => base().eq("state", "new").order("due", { ascending: true }).limit(newRoom),
      "Could not load new cards",
    );
  }

  if (rows.length === 0) return [];

  const cardIds = rows.map((r) => r.card_id);
  const [topics, tagsByCard, mediaByCard] = await Promise.all([
    getTopicTree(),
    tagsForCards(cardIds),
    mediaForCards(cardIds),
  ]);
  const pathById = new Map(topics.map((t) => [t.id, t.path]));

  const queue: QueueCard[] = rows.map((row) => {
    const { cards, ...scheduling } = row;
    return {
      card: cards,
      scheduling: scheduling as SchedulingRow,
      topicPath: cards.topic_id ? (pathById.get(cards.topic_id) ?? null) : null,
      tags: tagsByCard.get(row.card_id) ?? [],
      media: mediaByCard.get(row.card_id) ?? [],
    };
  });

  return shuffle(queue);
}


export async function mediaForCards(cardIds: string[]): Promise<Map<string, MediaItem[]>> {
  const map = new Map<string, MediaItem[]>();
  if (cardIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("media")
    .select("id,card_id,side,storage_path,thumb_path,width,height,caption,position")
    .in("card_id", cardIds)
    .order("position");

  for (const row of (data ?? []) as {
    id: string;
    card_id: string;
    side: "front" | "back";
    storage_path: string;
    thumb_path: string;
    width: number;
    height: number;
    caption: string | null;
    position: number;
  }[]) {
    const list = map.get(row.card_id) ?? [];
    list.push({
      id: row.id,
      side: row.side,
      url: publicUrl(row.storage_path),
      thumbUrl: publicUrl(row.thumb_path),
      width: row.width,
      height: row.height,
      caption: row.caption,
      position: row.position,
    });
    map.set(row.card_id, list);
  }
  return map;
}

async function tagsForCards(cardIds: string[]): Promise<Map<string, CardTag[]>> {
  const supabase = await createClient();

  // Цвет запрашивается отдельной попыткой: до миграции 0014 колонки нет, и
  // жёсткий запрос обрушил бы теги совсем. Без цвета они просто нейтральные —
  // ровно то, что «колонки нет» и означает.
  const withColor = await supabase
    .from("card_tags")
    .select("card_id, tags!inner(name,color)")
    .in("card_id", cardIds);
  const rows = withColor.error
    ? await supabase.from("card_tags").select("card_id, tags!inner(name)").in("card_id", cardIds)
    : withColor;

  const map = new Map<string, CardTag[]>();
  const data = (rows.data ?? []) as unknown as {
    card_id: string;
    tags: { name: string; color?: number | null };
  }[];
  for (const row of data) {
    const list = map.get(row.card_id) ?? [];
    list.push({ name: row.tags.name, slot: toSlot(row.tags.color) });
    map.set(row.card_id, list);
  }
  return map;
}

/** Перемешивание: порядок ввода не должен работать подсказкой (§8.2). */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
