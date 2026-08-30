"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Today" },
  { href: "/library", label: "Library" },
  { href: "/topics", label: "Topics" },
  { href: "/cards/new", label: "New" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * На телефоне навигация внизу, в зоне большого пальца; на десктопе — сверху (§11.1).
 * Один компонент вместо двух: разметка одна, меняется только позиционирование.
 */
export function Nav({ signOutAction }: { signOutAction: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur sm:static sm:border-t-0 sm:border-b sm:bg-transparent sm:backdrop-blur-none">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-2 pb-[env(safe-area-inset-bottom)] sm:px-6">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={`flex-1 rounded px-2 py-3 text-center text-[13px] font-medium sm:flex-none sm:py-4 sm:text-sm ${
              isActive(pathname, item.href) ? "text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <form action={signOutAction} className="hidden sm:block sm:ml-auto">
          <button type="submit" className="px-2 py-4 text-sm text-faint hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
