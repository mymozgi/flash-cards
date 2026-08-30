import { LoginForm } from "./login-form";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Kartoteka</h1>
      <p className="mt-2 text-sm text-muted">
        A personal spaced-repetition trainer. Owner access only.
      </p>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}
