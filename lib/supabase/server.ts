import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Клиент для серверных компонентов и server actions. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Вызов из серверного компонента: куки уже отправлены.
          // Обновление сессии всё равно произойдёт в proxy.ts.
        }
      },
    },
  });
}

/** Текущий пользователь или null. Всегда getUser(), а не getSession(). */
export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Пользователь или исключение. Вызывается в начале каждого server action:
 * actions доступны прямым POST-запросом, RLS — вторая линия обороны, не первая.
 */
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Sign-in required");
  return user;
}
