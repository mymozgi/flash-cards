import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** Клиент для клиентских компонентов. */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
