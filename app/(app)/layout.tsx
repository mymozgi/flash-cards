import { Nav } from "@/components/nav";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Nav signOutAction={signOut} />
      {/* нижняя панель на мобильном перекрывает контент — компенсируем отступом */}
      <main className="mx-auto max-w-4xl px-5 pb-28 pt-6 sm:px-6 sm:pb-16">{children}</main>
    </div>
  );
}
