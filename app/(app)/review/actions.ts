"use server";

import { revalidatePath } from "next/cache";
import type { Grade } from "ts-fsrs";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fromFsrsCard, scheduler, toFsrsCard } from "@/lib/fsrs";
import type { SchedulingRow } from "@/lib/types";

const SCHEDULING_FIELDS =
  "card_id,state,due,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,last_review";

export type GradeResult =
  | { ok: true; reviewId: number; scheduling: SchedulingRow }
  | { ok: false; error: string };

/**
 * Расчёт всегда на сервере: часы устройства не должны влиять на расписание (§8.1).
 * Клиент показывает свой оптимистичный результат мгновенно, но истина — эта запись.
 */
export async function gradeCard(
  cardId: string,
  rating: Grade,
  durationMs: number,
): Promise<GradeResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: current }, { data: settings }] = await Promise.all([
    supabase
      .from("scheduling")
      .select(SCHEDULING_FIELDS)
      .eq("card_id", cardId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("settings")
      .select("request_retention")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!current) return { ok: false, error: "Карточка не найдена" };

  const row = current as SchedulingRow;
  const retention = settings?.request_retention ?? 0.9;
  const now = new Date();

  const before = toFsrsCard(row);
  const { card: after } = scheduler(retention).next(before, now, rating);
  const next = fromFsrsCard(cardId, after);

  const { error: updateError } = await supabase
    .from("scheduling")
    .update(next)
    .eq("card_id", cardId)
    .eq("user_id", user.id);

  if (updateError) return { ok: false, error: updateError.message };

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      card_id: cardId,
      user_id: user.id,
      rating,
      reviewed_at: now.toISOString(),
      duration_ms: Math.max(0, Math.min(durationMs, 1000 * 60 * 10)),
      // храним ровно ту строку, что была в БД: так undo восстанавливает её без преобразований
      state_before: row,
      state_after: next,
    })
    .select("id")
    .single();

  if (reviewError) return { ok: false, error: reviewError.message };

  return {
    ok: true,
    reviewId: review.id as number,
    scheduling: { ...row, ...next } as SchedulingRow,
  };
}

/** Отмена последней оценки с восстановлением прежнего расписания (FR-54). */
export async function undoReview(reviewId: number): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("reviews")
    .select("id,card_id,state_before")
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .single();

  if (!review) return { ok: false, error: "Оценка не найдена" };

  const before = review.state_before as SchedulingRow;
  const { error } = await supabase
    .from("scheduling")
    .update({
      state: before.state,
      due: before.due,
      stability: before.stability,
      difficulty: before.difficulty,
      elapsed_days: before.elapsed_days,
      scheduled_days: before.scheduled_days,
      learning_steps: before.learning_steps,
      reps: before.reps,
      lapses: before.lapses,
      last_review: before.last_review,
    })
    .eq("card_id", review.card_id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", user.id);
  revalidatePath("/");
  return { ok: true };
}
