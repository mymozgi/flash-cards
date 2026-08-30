import { createClient, requireUser } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const [settings, user, supabase] = await Promise.all([
    getSettings(),
    requireUser(),
    createClient(),
  ]);

  const { data: extra } = await supabase
    .from("settings")
    .select("mcq_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <header className="border-b border-line pb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Signed in as {user.email}. These limits shape the daily queue; the scheduler itself is
          FSRS and runs on the server.
        </p>
      </header>
      <SettingsForm
        settings={{ ...settings, mcq_enabled: Boolean(extra?.mcq_enabled) }}
      />
    </>
  );
}
