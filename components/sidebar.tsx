"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { LinkButton } from "@/components/ui/button";
import {
  GridIcon,
  ListIcon,
  PlusIcon,
  MenuIcon,
  CloseIcon,
  SearchIcon,
  SettingsIcon,
  TableIcon,
  TagIcon,
  TrashIcon,
} from "./icons";

/*
  Две группы, и граница между ними смысловая: сверху — «учиться», снизу —
  «раскладывать по местам».

  Пункты меню сведены к одному на сущность. Прежние /topics и /stats
  переадресуют на своих преемников, поэтому старые ссылки и закладки живы.
*/
const GROUPS: { items: { href: string; label: string; Icon: typeof GridIcon }[] }[] = [
  {
    items: [
      /*
        «Review due» и «Practice» из меню убраны. Оба вели на /review, то есть
        три пункта верхней группы отправляли в два места. Вход в повторение
        остался там, где он и должен быть, — на «Today»: там видно, сколько
        карточек ждёт, и кнопка стоит рядом с этим числом. Пункт меню такого
        контекста не даёт и предлагает начать сессию вслепую.
      */
      { href: "/", label: "Today", Icon: ListIcon },
      { href: "/decks", label: "My flashcards", Icon: GridIcon },
    ],
  },
  {
    items: [
      /*
        Два способа разложить одни и те же карточки, и оба названы своим
        словом. Категория — место карточки, одно на карточку. Тег — признак,
        их сколько угодно и они режут дерево поперёк.

        Слито то, что было раздвоено: «Tag statistics» уехала на экран тегов
        (смотреть долю в одном месте, а переименовывать в другом — беготня),
        «All cards» стал видом List внутри категорий, а «Manage categories»
        исчез вместе с дублем дерева.
      */
      { href: "/knowledge", label: "Categories", Icon: ListIcon },
      { href: "/import", label: "Import", Icon: TableIcon },
      { href: "/trash", label: "Deleted cards", Icon: TrashIcon },
      { href: "/how-it-works", label: "How it works", Icon: TagIcon },
      { href: "/settings", label: "Settings", Icon: SettingsIcon },
    ],
  },
];

/** Гостю показываем только то, что он может открыть. Пункты, ведущие в отказ,
    хуже отсутствующих: они выглядят поломкой, а не границей доступа. */
const GUEST_GROUPS: typeof GROUPS = [
  {
    items: [
      { href: "/decks", label: "My flashcards", Icon: GridIcon },
      { href: "/library", label: "All cards", Icon: SearchIcon },
      { href: "/how-it-works", label: "How it works", Icon: TagIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
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
          <MenuIcon />
        </button>
        <span className="min-w-0">
          <span className="block truncate font-bold leading-tight">Memorizer</span>
          <span className="block truncate text-2xs text-faint">by Oleg Tsykhonia</span>
        </span>
        <div className="ml-auto">
          <ThemeToggle compact />
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
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate font-bold leading-tight">Memorizer</span>
              <span className="block truncate text-2xs text-faint">by Oleg Tsykhonia</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            className="hidden text-muted hover:text-ink lg:block"
          >
            <MenuIcon />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="text-muted hover:text-ink lg:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        {isGuest ? (
          <LinkButton
            href="/login"
            tone="primary"
            size={collapsed ? "icon" : "md"}
            onClick={() => setOpen(false)}
            className={collapsed ? "mx-auto" : ""}
          >
            {collapsed ? "→" : "Sign in"}
          </LinkButton>
        ) : (
          <LinkButton
            href="/decks?new=1"
            tone="primary"
            size={collapsed ? "icon" : "md"}
            onClick={() => setOpen(false)}
            className={collapsed ? "mx-auto" : ""}
          >
            <PlusIcon />
            {!collapsed && "Create set"}
          </LinkButton>
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
