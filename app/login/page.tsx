import { LoginForm } from "./login-form";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight">Memorizer</h1>
      <p className="mt-1 text-sm text-faint">by Oleg Tsykhonia</p>
      <p className="mt-2 text-sm text-muted">
        A personal spaced-repetition trainer. Owner access only.
      </p>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}
