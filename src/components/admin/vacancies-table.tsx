"use client";

import { useState } from "react";
import {
  AdminCard,
  AdminCardActions,
  AdminCardList,
  AdminCardMeta,
} from "@/components/admin/admin-mobile-cards";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useLocalizedRouter } from "@/lib/i18n/client";
import { moderationStatuses, type ModerationStatus } from "@/lib/moderation";

export type AdminVacancyRow = {
  id: string;
  title: string;
  href: string;
  companyName: string;
  companyHref: string;
  companyVerified: boolean;
  stateLabel: string;
  moderationStatus: string;
  moderationNote: string | null;
  createdAtLabel: string;
};

type Labels = {
  columns: {
    vacancy: string;
    company: string;
    state: string;
    status: string;
    created: string;
    actions: string;
  };
  approve: string;
  open: string;
  status: string;
  verified: string;
  saved: string;
  error: string;
};

/**
 * /admin/content/vacancies: let a held vacancy out or hide one. Decisions go
 * through /api/admin/moderation, so they land in the audit log and the team
 * hears of them. Table on md+, cards below, like the other admin lists.
 */
export default function AdminVacanciesTable({
  items,
  labels,
  statusLabels,
}: {
  items: AdminVacancyRow[];
  labels: Labels;
  statusLabels: Record<ModerationStatus, string>;
}) {
  const router = useLocalizedRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function setStatus(id: string, moderationStatus: string) {
    setPendingId(id);
    const result = await apiFetch("/api/admin/moderation", {
      method: "POST",
      body: { targetType: "vacancy", targetId: id, moderationStatus },
    });
    setPendingId(null);

    if (!result.ok) {
      toast.error(labels.error);
      return;
    }

    toast.success(labels.saved);
    router.refresh();
  }

  const statusSelect = (item: AdminVacancyRow) => (
    <div role="group" aria-label={labels.status.replace("{name}", item.title)}>
      <FormSelect
        value={(item.moderationStatus as ModerationStatus) || "approved"}
        disabled={pendingId === item.id}
        onChange={(value) => void setStatus(item.id, value)}
        options={moderationStatuses.map((status) => ({
          value: status,
          label: statusLabels[status],
        }))}
      />
    </div>
  );

  const actions = (item: AdminVacancyRow) => (
    <>
      {item.moderationStatus === "under_review" ? (
        <Button
          size="sm"
          disabled={pendingId === item.id}
          onClick={() => void setStatus(item.id, "approved")}
        >
          {labels.approve}
        </Button>
      ) : null}
      <Button variant="ghost" size="sm" onClick={() => router.push(item.href)}>
        {labels.open}
      </Button>
    </>
  );

  const titleCell = (item: AdminVacancyRow) => (
    <div className="min-w-0 space-y-0.5">
      <a
        href={item.href}
        className="block break-words font-medium text-[color:var(--foreground)] underline-offset-4 hover:underline"
      >
        {item.title}
      </a>
      {item.moderationNote ? <p className="text-xs app-soft">{item.moderationNote}</p> : null}
    </div>
  );

  const companyCell = (item: AdminVacancyRow) => (
    <span className="app-muted">
      <a href={item.companyHref} className="underline-offset-4 hover:underline">
        {item.companyName}
      </a>
      {item.companyVerified ? ` · ${labels.verified}` : ""}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b app-border text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
              <th className="px-3 py-2">{labels.columns.vacancy}</th>
              <th className="px-3 py-2">{labels.columns.company}</th>
              <th className="px-3 py-2">{labels.columns.state}</th>
              <th className="px-3 py-2">{labels.columns.status}</th>
              <th className="px-3 py-2">{labels.columns.created}</th>
              <th className="px-3 py-2 text-right">{labels.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b app-border align-top">
                <td className="px-3 py-3">{titleCell(item)}</td>
                <td className="px-3 py-3">{companyCell(item)}</td>
                <td className="px-3 py-3 app-muted">{item.stateLabel}</td>
                <td className="px-3 py-3">{statusSelect(item)}</td>
                <td className="px-3 py-3 app-muted">{item.createdAtLabel}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">{actions(item)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminCardList>
        {items.map((item) => (
          <AdminCard key={item.id}>
            {titleCell(item)}
            <AdminCardMeta>{companyCell(item)}</AdminCardMeta>
            <AdminCardMeta label={labels.columns.state}>
              {item.stateLabel} · {item.createdAtLabel}
            </AdminCardMeta>
            <div className="space-y-1">
              <span className="block text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {labels.columns.status}
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
