"use client";

import Link from "next/link";
import AdminContentQuickActions from "@/components/admin-content-quick-actions";
import ContentBulkTable from "@/components/admin/content-bulk-table";
import StatusBadge from "@/components/admin/status-badge";
import type { ModerationStatus } from "@/lib/moderation";

export type ProjectTableItem = {
  id: string;
  title: string;
  href: string;
  authorLabel: string;
  authorHref: string | null;
  moderationStatus: ModerationStatus | null;
  createdAtLabel: string;
  likes: number;
  dislikes: number;
};

type BulkLabels = {
  selected: string;
  clear: string;
  bulkApprove: string;
  bulkHide: string;
  bulkRestrict: string;
  bulkDelete: string;
  applying: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  cancel: string;
  errorFallback: string;
};

type Props = {
  items: ProjectTableItem[];
  statusLabels: Record<string, string>;
  columnLabels: {
    title: string;
    author: string;
    status: string;
    created: string;
    engagement: string;
    actions: string;
  };
  openLabel: string;
  bulkLabels: BulkLabels;
  locale: string;
  redirectAfterDelete: string;
};

export default function ProjectsTableClient({
  items,
  statusLabels,
  columnLabels,
  openLabel,
  bulkLabels,
  locale,
  redirectAfterDelete,
}: Props) {
  const ids = items.map((item) => item.id);

  return (
    <ContentBulkTable targetType="project" ids={ids} labels={bulkLabels}>
      {({ selected, toggle, toggleAll, allSelected }) => (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-3">{columnLabels.title}</th>
                <th className="px-3 py-3">{columnLabels.author}</th>
                <th className="px-3 py-3">{columnLabels.status}</th>
                <th className="px-3 py-3">{columnLabels.created}</th>
                <th className="px-3 py-3">{columnLabels.engagement}</th>
                <th className="px-3 py-3 text-right">{columnLabels.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[color:var(--border)] align-top"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={`Select ${item.title}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={item.href}
                      className="font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    {item.authorHref ? (
                      <Link
                        href={item.authorHref}
                        className="text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                      >
                        {item.authorLabel}
                      </Link>
                    ) : (
                      <span className="app-muted">{item.authorLabel}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={item.moderationStatus}
                      labels={statusLabels}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className="app-muted">{item.createdAtLabel}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="app-muted">
                      ▲ {item.likes} · ▼ {item.dislikes}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={item.href}
                        className="inline-flex items-center rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)]"
                      >
                        {openLabel}
                      </Link>
                      <AdminContentQuickActions
                        targetType="project"
                        targetId={item.id}
                        currentStatus={item.moderationStatus}
                        locale={locale}
                        redirectAfterDelete={redirectAfterDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ContentBulkTable>
  );
}
