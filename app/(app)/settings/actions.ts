"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";

export type SettingsState = { error: string | null; ok?: boolean };

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const supabase = await createClient();

  const newLimit = Number(formData.get("daily_new_limit"));
  const reviewLimit = Number(formData.get("daily_review_limit"));
  const retention = Number(formData.get("request_retention"));
  const timezone = String(formData.get("timezone") ?? "UTC");
  const mcq = formData.get("mcq_enabled") === "on";
  const publicLibrary = formData.get("public_library") === "on";

  if (!Number.isFinite(newLimit) || newLimit < 0 || newLimit > 500) {
    return { error: "New cards per day must be between 0 and 500" };
  }
  if (!Number.isFinite(reviewLimit) || reviewLimit < 0 || reviewLimit > 5000) {
    return { error: "Reviews per day must be between 0 and 5000" };
  }
  if (!Number.isFinite(retention) || retention < 0.7 || retention > 0.98) {
    return { error: "Retention target must be between 0.70 and 0.98" };
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: `“${timezone}” is not a valid time zone` };
  }

  const { error } = await supabase.from("settings").upsert({
    user_id: user.id,
    daily_new_limit: Math.round(newLimit),
    daily_review_limit: Math.round(reviewLimit),
    request_retention: retention,
    timezone,
    mcq_enabled: mcq,
    public_library: publicLibrary,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
