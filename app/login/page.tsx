import { LinkButton } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

/**
 * Ссылку для гостей показываем, только когда библиотека действительно открыта.
 * Проверка честная: пробуем прочитать темы тем же анонимным клиентом, которым
 * их будет читать гость. Отказ в доступе означает, что делиться нечем, и
 * приглашать некуда — предложение, ведущее в пустой экран, хуже его отсутствия.
 */
async function libraryIsShared(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("topics").select("id").limit(1);
  return !error;
}

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, shared] = await Promise.all([props.searchParams, libraryIsShared()]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Memorizer</h1>
      <p className="mt-1 text-sm text-faint">by Oleg Tsykhonia</p>
      <p className="mt-3 text-sm text-muted">
        {shared
          ? "A personal spaced-repetition trainer. The library is open for reading; signing in is for the owner."
          : "A personal spaced-repetition trainer. Owner access only."}
      </p>

      <LoginForm next={next ?? "/"} />

      {shared && (
        <div className="mt-8 border-t border-line pt-6 text-center">
          <p className="text-sm text-muted">No account needed to look around.</p>
          <LinkButton href="/decks" className="mt-2">
            Browse the library as a guest
          </LinkButton>
          <p className="mt-2 text-2xs text-faint">
            Guests can read cards and sets. Nothing can be added, changed or deleted.
          </p>
        </div>
      )}
    </main>
  );
}
