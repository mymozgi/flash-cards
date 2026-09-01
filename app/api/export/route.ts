import Papa from "papaparse";
import { createClient, requireUser } from "@/lib/supabase/server";

/**
 * Выгрузка всей базы (FR-40). Данные не должны запираться в приложении:
 * CSV повторяет формат импорта, JSON забирает ещё расписание и историю
 * повторений — из него можно восстановить состояние, а не только тексты.
 */
export const dynamic = "force-dynamic";

type CardExport = {
  id: string;
  topic_id: string | null;
  front_md: string;
  back_md: string;
  note_md: string | null;
  kind: string;
  distractors: string[];
  suspended: boolean;
  created_at: string;
  card_tags: { tags: { name: string } }[];
  scheduling: { state: string; due: string; reps: number; lapses: number } | null;
};

export async function GET(request: Request) {
  const user = await requireUser();
  const supabase = await createClient();
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  const [{ data: cards }, { data: topics }] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id,topic_id,front_md,back_md,note_md,kind,distractors,suspended,created_at, card_tags(tags(name)), scheduling(state,due,reps,lapses)",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("topics").select("id,parent_id,name").eq("user_id", user.id),
  ]);

  const rows = (cards ?? []) as unknown as CardExport[];
  const topicRows = (topics ?? []) as { id: string; parent_id: string | null; name: string }[];

  const byId = new Map(topicRows.map((t) => [t.id, t]));
  const pathOf = (id: string | null): string => {
    const parts: string[] = [];
    let cursor = id ? byId.get(id) : undefined;
    let guard = 0;
    while (cursor && guard++ < 5) {
      parts.unshift(cursor.name);
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    }
    return parts.join(" / ");
  };

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("card_id,rating,reviewed_at,duration_ms")
      .eq("user_id", user.id)
      .order("reviewed_at");

    const body = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        topics: topicRows.map((t) => ({ ...t, path: pathOf(t.id) })),
        cards: rows.map((card) => ({
          ...card,
          topic_path: pathOf(card.topic_id),
          tags: (card.card_tags ?? []).map((t) => t.tags.name),
          card_tags: undefined,
        })),
        reviews: reviews ?? [],
      },
      null,
      2,
    );

    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="memorizer-${stamp}.json"`,
      },
    });
  }

  const csv = Papa.unparse(
    rows.map((card) => ({
      front: card.front_md,
      back: card.back_md,
      topic: pathOf(card.topic_id),
      tags: (card.card_tags ?? []).map((t) => t.tags.name).join(", "),
      note: card.note_md ?? "",
      reversed: card.kind === "reversed_of" ? 1 : 0,
      choice1: card.distractors?.[0] ?? "",
      choice2: card.distractors?.[1] ?? "",
      choice3: card.distractors?.[2] ?? "",
    })),
  );

  // BOM, чтобы Excel не принял UTF-8 за системную кодировку
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="memorizer-${stamp}.csv"`,
    },
  });
}
