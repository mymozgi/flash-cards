"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE, REMEMBER_DAYS } from "@/lib/supabase/remember";

export type LoginState = { error: string | null };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const remember = formData.get("remember") === "on";

  // Выбор записываем до входа: клиент Supabase прочитает его, когда будет
  // ставить куки сессии, и задаст им нужный срок жизни
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    maxAge: remember ? REMEMBER_DAYS * 24 * 60 * 60 : undefined,
  });

  if (!email || !password) {
    return { error: "Enter your email and password" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Wrong email or password"
          : `Sign-in failed: ${error.message}`,
    };
  }

  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
