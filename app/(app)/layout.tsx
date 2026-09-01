import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/app/login/actions";
import { currentUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const isGuest = !user;

  return (
    <div className="lg:flex">
      <Sidebar signOutAction={signOut} isGuest={isGuest} />
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-12">
        {isGuest && (
          <p className="mb-4 rounded-lg bg-accent-soft px-4 py-2.5 text-sm text-accent">
            You are viewing a shared library. Cards can be read but not changed.{" "}
            <Link href="/login" className="font-medium underline underline-offset-4">
              Sign in
            </Link>{" "}
            if it is yours.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
