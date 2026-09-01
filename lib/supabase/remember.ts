import type { CookieOptions } from "@supabase/ssr";

/**
 * «Запомнить меня» — это срок жизни куки сессии, а не отдельный вход.
 *
 * Supabase и так хранит сессию в куках и обновляет её сам, поэтому галочка
 * легко могла бы стать декорацией. Здесь она управляет настоящим поведением:
 *
 *   отмечена  — кука живёт 30 дней и переживает закрытие браузера;
 *   снята     — кука сессионная и умирает вместе с вкладкой.
 *
 * Второе имеет смысл на чужом или общем компьютере.
 */
export const REMEMBER_COOKIE = "mz-remember";
export const REMEMBER_DAYS = 30;

export function applyRemember(options: CookieOptions, remember: boolean): CookieOptions {
  if (remember) {
    return { ...options, maxAge: REMEMBER_DAYS * 24 * 60 * 60 };
  }
  // Сессионная кука: ни maxAge, ни expires — браузер удалит её при закрытии
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
