import "server-only";
import { createClient, requireUser } from "./supabase/server";
import { startOfDay } from "./day";
import type {
  CardRow,
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
  "id,topic_id,front_md,back_md,note_md,kind,suspended,created_at,updated_at";

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
    supabase.from("topics").select("id,parent_id,name,position").order("position").order("name"),
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

export async function getTags(): Promise<TagRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("id,name").order("name");
  return (data ?? []) as TagRow[];
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

  const due = Math.min(dueRes.count ?? 0, Math.max(0, settings.daily_review_limit - reviewsDoneToday));
  const newAvailable = Math.min(
    newRes.count ?? 0,
    Math.max(0, settings.daily_new_limit - newDoneToday),
  );

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

  const base = () => {
    let q = supabase
      .from("scheduling")
      .select(`${SCHEDULING_FIELDS}, cards!inner(${CARD_FIELDS})`)
      .eq("user_id", user.id)
      .eq("cards.suspended", false)
      .is("cards.deleted_at", null);
    if (options.topicIds?.length) q = q.in("cards.topic_id", options.topicIds);
    if (cardIdFilter) q = q.in("card_id", cardIdFilter);
    return q;
  };

  const reviewLimit = options.ignoreSchedule ? (options.limit ?? 100) : counts.due;
  const newLimit = options.ignoreSchedule ? 0 : counts.newAvailable;

  const dueQuery = base().neq("state", "new").order("due", { ascending: true });
  const rows: SchedulingWithCard[] = [];

  if (reviewLimit > 0) {
    const q = options.ignoreSchedule ? dueQuery : dueQuery.lte("due", nowIso);
    const { data } = await q.limit(reviewLimit);
    rows.push(...((data ?? []) as unknown as SchedulingWithCard[]));
  }

  if (options.ignoreSchedule && rows.length < (options.limit ?? 100)) {
    const { data } = await base()
      .eq("state", "new")
      .order("due", { ascending: true })
      .limit((options.limit ?? 100) - rows.length);
    rows.push(...((data ?? []) as unknown as SchedulingWithCard[]));
  } else if (newLimit > 0) {
    const { data } = await base()
      .eq("state", "new")
      .order("due", { ascending: true })
      .limit(newLimit);
    rows.push(...((data ?? []) as unknown as SchedulingWithCard[]));
  }

  if (rows.length === 0) return [];

  const [topics, tagsByCard] = await Promise.all([
    getTopicTree(),
    tagsForCards(rows.map((r) => r.card_id)),
  ]);
  const pathById = new Map(topics.map((t) => [t.id, t.path]));

  const queue: QueueCard[] = rows.map((row) => {
    const { cards, ...scheduling } = row;
    return {
      card: cards,
      scheduling: scheduling as SchedulingRow,
      topicPath: cards.topic_id ? (pathById.get(cards.topic_id) ?? null) : null,
      tags: tagsByCard.get(row.card_id) ?? [],
    };
  });

  return shuffle(queue);
}

async function tagsForCards(cardIds: string[]): Promise<Map<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_tags")
    .select("card_id, tags!inner(name)")
    .in("card_id", cardIds);

  const map = new Map<string, string[]>();
  for (const row of (data ?? []) as unknown as { card_id: string; tags: { name: string } }[]) {
    const list = map.get(row.card_id) ?? [];
    list.push(row.tags.name);
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
