import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:flex">
      <Sidebar signOutAction={signOut} />
      <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:pb-12">
        {children}
      </main>
    </div>
  );
}
