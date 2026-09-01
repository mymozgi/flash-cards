"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-faint">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded border border-line bg-surface px-3 py-2.5 text-base"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-faint">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border border-line bg-surface px-3 py-2.5 text-base"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded border-l-[3px] border-rust bg-rust-soft px-3 py-2 text-sm">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded bg-accent px-4 py-3 font-medium text-accent-ink disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
