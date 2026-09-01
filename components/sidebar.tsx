"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import {
  GridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TableIcon,
  TagIcon,
  TrashIcon,
} from "./icons";

const GROUPS: { items: { href: string; label: string; Icon: typeof GridIcon }[] }[] = [
  {
    items: [
      { href: "/", label: "Today", Icon: ListIcon },
      { href: "/decks", label: "Flashcard sets", Icon: GridIcon },
      { href: "/review", label: "Review due", Icon: SearchIcon },
      // Свободная тренировка доступна всегда: расписание может быть пустым,
      // а желание повторить — нет
      { href: "/review?free=1", label: "Practice", Icon: PlusIcon },
      { href: "/stats", label: "Knowledge areas", Icon: TableIcon },
      { href: "/how-it-works", label: "How it works", Icon: TagIcon },
    ],
  },
  {
    items: [
      { href: "/import", label: "Import CSV", Icon: TableIcon },
      { href: "/topics", label: "Manage categories", Icon: ListIcon },
      { href: "/tags", label: "Manage tags", Icon: TagIcon },
      { href: "/trash", label: "Deleted cards", Icon: TrashIcon },
      { href: "/settings", label: "Settings", Icon: SettingsIcon },
    ],
  },
];

/** Гостю показываем только то, что он может открыть. Пункты, ведущие в отказ,
    хуже отсутствующих: они выглядят поломкой, а не границей доступа. */
const GUEST_GROUPS: typeof GROUPS = [
  {
    items: [
      { href: "/decks", label: "Flashcard sets", Icon: GridIcon },
      { href: "/library", label: "Browse cards", Icon: SearchIcon },
      { href: "/how-it-works", label: "How it works", Icon: TagIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // у Review и Practice один путь, поэтому по нему подсвечиваем только Review
  return pathname.startsWith(href.split("?")[0]) && !href.includes("?");
}

/**
 * Боковое меню на десктопе, выдвижное на телефоне. Сворачивается до иконок:
 * на ноутбуке с коротким экраном 240 px ширины заметно дороже, чем кажется.
 */
export function Sidebar({
  signOutAction,
  isGuest = false,
}: {
  signOutAction: () => Promise<void>;
  isGuest?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* полоса с гамбургером — только на телефоне */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="text-muted hover:text-ink"
        >
          ☰
        </button>
        <span className="font-semibold">Flashcards</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col gap-2 border-r border-line bg-surface p-3 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-16" : "w-60"}`}
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          {!collapsed && <span className="font-semibold">Workspace</span>}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            className="hidden text-muted hover:text-ink lg:block"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="text-muted hover:text-ink lg:hidden"
          >
            ✕
          </button>
        </div>

        {isGuest ? (
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-ink"
          >
            {collapsed ? "→" : "Sign in"}
          </Link>
        ) : (
          <Link
            href="/decks?new=1"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-ink"
          >
            <PlusIcon />
            {!collapsed && "Create set"}
          </Link>
        )}

        {(isGuest ? GUEST_GROUPS : GROUPS).map((group, i) => (
          <nav key={i} className={i > 0 ? "mt-2 border-t border-line pt-2" : ""}>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      isActive(pathname, item.href)
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <item.Icon />
                    {!collapsed && item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          {!isGuest && (
            <form action={signOutAction}>
              <button type="submit" className="px-2 py-2 text-sm text-faint hover:text-ink">
                {collapsed ? "→" : "Sign out"}
              </button>
            </form>
          )}
        </div>
      </aside>
    </>
  );
}
