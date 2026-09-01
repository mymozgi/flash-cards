import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

// /api/cron защищён своим секретом, сессия ему не нужна
const PUBLIC_PATHS = ["/login", "/auth", "/api/cron"];

/**
 * Что видит гость, когда владелец включил общий доступ.
 *
 * Список намеренно узкий: только чтение. Конструктор колоды сюда не входит —
 * это редактор, даже если гостю всё равно не дали бы записать. Повторение тоже:
 * оно пишет оценки и двигает расписание владельца.
 *
 * Настоящая защита — права в базе; этот список лишь не пускает гостя на
 * страницы, которые всё равно упадут без сессии.
 */
const GUEST_PATHS = [
  /^\/decks$/,
  /^\/decks\/[^/]+\/study$/,
  /^\/library$/,
  /^\/how-it-works$/,
];

/**
 * В Next 16 middleware переименован в proxy (см. docs/01-app/01-getting-started/16-proxy.md).
 * Задача — обновить куки сессии Supabase и увести гостя на /login.
 * Это оптимистичная проверка: доступ к данным всё равно закрыт RLS.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const isGuestReadable = GUEST_PATHS.some((pattern) => pattern.test(path));

  if (!user && !isPublic && !isGuestReadable) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  if (user && path === "/login") {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

// sw.js и offline.html обязаны отдаваться как есть: редирект на /login
// сломал бы регистрацию сервис-воркера — браузер получил бы неверный MIME-тип
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
