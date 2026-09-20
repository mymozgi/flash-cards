import Papa from "papaparse";
import { createClient, requireUser } from "@/lib/supabase/server";
import { splitTopicPath } from "@/lib/knowledge-tree";
import { withOptional } from "@/lib/schema";

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
  example_md: string | null;
  /* Необязательные: до своих миграций их в базе нет вовсе */
  link_url?: string | null;
  source_label?: string | null;
  kind: string;
  distractors: string[];
  suspended: boolean;
  created_at: string;
  scheduling: { state: string; due: string; reps: number; lapses: number } | null;
};

export async function GET(request: Request) {
  const user = await requireUser();
  const supabase = await createClient();
  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";

  const [{ data: cards }, { data: topics }] = await Promise.all([
    supabase
      .from("cards")
      /*
        Необязательные колонки добавляются мягко. Назвать их жёстко значило
        бы, что до применения миграции ломается вся выгрузка — а выгрузка это
        последнее, что можно ломать: именно к ней идут, когда всё остальное
        сломалось.
      */
      .select(
        withOptional(
          "id,topic_id,front_md,back_md,note_md,example_md,kind,distractors,suspended,created_at, scheduling(state,due,reps,lapses)",
          "link_url",
          "source_label",
        ),
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
      // Ровно те же колонки, что понимает импорт: выгрузка, которую нельзя
      // прочитать обратно, резервной копией не является
      category: splitTopicPath(pathOf(card.topic_id)).category ?? "",
      area: splitTopicPath(pathOf(card.topic_id)).topic ?? "",
      note: card.note_md ?? "",
      example: card.example_md ?? "",
      source: card.source_label ?? "",
      sourceUrl: card.link_url ?? "",
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
