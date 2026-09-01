"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

const initial: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5">
        <span className="pb-1.5 text-sm font-medium text-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="pb-1.5 text-sm font-medium text-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" tone="primary" size="lg" loading={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
