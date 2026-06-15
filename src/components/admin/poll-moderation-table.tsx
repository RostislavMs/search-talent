"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import {
  AdminCard,
  AdminCardActions,
  AdminCardList,
  AdminCardMeta,
} from "@/components/admin/admin-mobile-cards";
import DeletePollButton from "@/components/delete-poll-button";
import { apiFetch } from "@/lib/api-client";
import { useLocalizedRouter } from "@/lib/i18n/client";
import type { ModerationStatus } from "@/lib/moderation";

type PollRow = {
  id: string;
  title: string;
  href: string;
  authorLabel: string;
  moderationStatus: string | null;
  createdAtLabel: string;
  responsesCount: number;
  commentsCount: number;
};

export default function PollModerationTable({
  items,
  locale,
  statusLabels,
  columnLabels,
  openLabel,
  errorFallback,
  redirectAfterDelete,
}: {
  items: PollRow[];
  locale: string;
  statusLabels: Record<ModerationStatus, string>;
  columnLabels: {
    title: string;
    author: string;
    status: string;
    created: string;
    engagement: string;
    actions: string;
  };
  openLabel: string;
  errorFallback: string;
  redirectAfterDelete: string;
}) {
  const router = useLocalizedRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statuses: ModerationStatus[] = ["approved", "under_review", "restricted", "removed"];

  const updateStatus = async (id: string, status: ModerationStatus) => {
    setPendingId(id);
    setError(null);
    const result = await apiFetch(`/api/admin/polls/${id}`, {
      method: "PATCH",
      body: { moderation_status: status, moderation_note: null },
    });
    setPendingId(null);
    if (!result.ok) {
      setError(result.error || errorFallback);
      return;
    }
    router.refresh();
  };

  const statusSelect = (item: PollRow) => (
    <FormSelect
      value={(item.moderationStatus as ModerationStatus) || "approved"}
      onChange={(value) => void updateStatus(item.id, value as ModerationStatus)}
      disabled={pendingId === item.id}
      options={statuses.map((status) => ({
        value: status,
        label: statusLabels[status],
      }))}
    />
  );

  const actions = (item: PollRow) => (
    <>
      <Button variant="ghost" size="sm" onClick={() => router.push(item.href)}>
        {openLabel}
      </Button>
      <DeletePollButton
        pollId={item.id}
        locale={locale}
        adminEndpoint
        redirectHref={redirectAfterDelete}
      />
    </>
  );

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      {/* Desktop: table. No overflow wrapper — it would clip the status
          dropdown (overflow-x:auto forces overflow-y:auto). Mobile uses cards. */}
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b app-border text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
              <th className="px-3 py-2">{columnLabels.title}</th>
              <th className="px-3 py-2">{columnLabels.author}</th>
              <th className="px-3 py-2">{columnLabels.status}</th>
              <th className="px-3 py-2">{columnLabels.created}</th>
              <th className="px-3 py-2">{columnLabels.engagement}</th>
              <th className="px-3 py-2 text-right">{columnLabels.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b app-border align-top">
                <td className="px-3 py-3">
                  <a
                    href={item.href}
                    className="font-medium text-[color:var(--foreground)] underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </a>
                </td>
                <td className="px-3 py-3 app-muted">{item.authorLabel}</td>
                <td className="px-3 py-3">{statusSelect(item)}</td>
                <td className="px-3 py-3 app-muted">{item.createdAtLabel}</td>
                <td className="px-3 py-3 app-muted tabular-nums">
                  {item.responsesCount} · {item.commentsCount}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">{actions(item)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <AdminCardList>
        {items.map((item) => (
          <AdminCard key={item.id}>
            <div className="space-y-1">
              <a
                href={item.href}
                className="block break-words font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
              >
                {item.title}
              </a>
              <AdminCardMeta>
                {item.authorLabel} · {item.createdAtLabel}
              </AdminCardMeta>
              <AdminCardMeta label={columnLabels.engagement}>
                <span className="tabular-nums">
                  {item.responsesCount} · {item.commentsCount}
                </span>
              </AdminCardMeta>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {columnLabels.status}
              </span>
              {statusSelect(item)}
            </div>
            <AdminCardActions>{actions(item)}</AdminCardActions>
          </AdminCard>
        ))}
      </AdminCardList>
    </div>
  );
}
