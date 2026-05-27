"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createLocalePath, type Locale } from "@/lib/i18n/config";

type SidebarItem = {
  href: string;
  label: string;
  icon: string;
};

type SidebarGroup = {
  label: string | null;
  items: SidebarItem[];
};

type Props = {
  locale: Locale;
  labels: {
    overview: string;
    users: string;
    moderation: string;
    audit: string;
  };
  contentLabels: {
    articles: string;
    projects: string;
    comments: string;
  };
  groupLabels: {
    main: string;
    content: string;
    users: string;
    tools: string;
  };
  feedbackLabel: string;
};

export default function AdminSidebar({
  locale,
  labels,
  contentLabels,
  groupLabels,
  feedbackLabel,
}: Props) {
  const pathname = usePathname();

  const groups: SidebarGroup[] = [
    {
      label: groupLabels.main,
      items: [{ href: "/admin", label: labels.overview, icon: "▦" }],
    },
    {
      label: groupLabels.users,
      items: [{ href: "/admin/users", label: labels.users, icon: "◉" }],
    },
    {
      label: groupLabels.content,
      items: [
        { href: "/admin/content/articles", label: contentLabels.articles, icon: "✎" },
        { href: "/admin/content/projects", label: contentLabels.projects, icon: "▤" },
        { href: "/admin/content/comments", label: contentLabels.comments, icon: "✱" },
      ],
    },
    {
      label: groupLabels.tools,
      items: [
        { href: "/admin/moderation", label: labels.moderation, icon: "⚑" },
        { href: "/admin/feedback", label: feedbackLabel, icon: "✉" },
        { href: "/admin/audit", label: labels.audit, icon: "≡" },
      ],
    },
  ];

  const normalized = pathname ? pathname.replace(/\/$/, "") : "";

  function isActive(href: string) {
    const target = createLocalePath(locale, href).replace(/\/$/, "");

    if (href === "/admin") {
      return normalized === target;
    }

    return normalized === target || normalized.startsWith(`${target}/`);
  }

  return (
    <nav className="flex flex-col gap-4" aria-label="Admin navigation">
      {groups.map((group) => (
        <div key={group.label || "root"} className="flex flex-col gap-1">
          {group.label ? (
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-eyebrow app-soft">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={createLocalePath(locale, item.href)}
                className={[
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 items-center justify-center text-sm"
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
