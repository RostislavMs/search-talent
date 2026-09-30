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

export type AdminCompanyRow = {
  id: string;
  name: string;
  href: string;
  website: string | null;
  typeLabel: string;
  creatorLabel: string;
  membersCount: number;
  verified: boolean;
  verificationLabel: string;
  moderationStatus: string;
  createdAtLabel: string;
};

type Labels = {
  columns: {
    company: string;
    creator: string;
    team: string;
    verification: string;
    status: string;
    created: string;
    actions: string;
  };
  verify: string;
  unverify: string;
  open: string;
  status: string;
  saved: string;
  error: string;
};

/**
 * /admin/companies list: confirm or take back the check mark, set the
 * moderation status. Table on md+, cards below, like the other admin lists.
 */
export default function AdminCompaniesTable({
  items,
  labels,
  statusLabels,
}: {
  items: AdminCompanyRow[];
  labels: Labels;
  statusLabels: Record<ModerationStatus, string>;
}) {
  const router = useLocalizedRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function update(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    const result = await apiFetch(`/api/admin/companies/${id}`, { method: "PATCH", body });
    setPendingId(null);

    if (!result.ok) {
      toast.error(labels.error);
      return;
    }

    toast.success(labels.saved);
    router.refresh();
  }

  const statusSelect = (item: AdminCompanyRow) => (
    <div role="group" aria-label={labels.status.replace("{name}", item.name)}>
      <FormSelect
        value={(item.moderationStatus as ModerationStatus) || "approved"}
        disabled={pendingId === item.id}
        onChange={(value) => void update(item.id, { moderation_status: value })}
        options={moderationStatuses.map((status) => ({
          value: status,
          label: statusLabels[status],
        }))}
      />
    </div>
  );

  const actions = (item: AdminCompanyRow) => (
    <>
      <Button
        size="sm"
        variant={item.verified ? "ghost" : "primary"}
        disabled={pendingId === item.id}
        onClick={() => void update(item.id, { verified: !item.verified })}
      >
        {item.verified ? labels.unverify : labels.verify}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => router.push(item.href)}>
        {labels.open}
      </Button>
    </>
  );

  const nameCell = (item: AdminCompanyRow) => (
    <div className="min-w-0 space-y-0.5">
      <a
        href={item.href}
        className="block break-words font-medium text-[color:var(--foreground)] underline-offset-4 hover:underline"
      >
        {item.name}
      </a>
      <p className="text-xs app-soft">
        {item.typeLabel}
        {item.website ? (
          <>
            {" · "}
            <a
              href={item.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline-offset-4 hover:underline"
            >
              {item.website.replace(/^https?:\/\//, "")}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b app-border text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
              <th className="px-3 py-2">{labels.columns.company}</th>
              <th className="px-3 py-2">{labels.columns.creator}</th>
              <th className="px-3 py-2">{labels.columns.team}</th>
              <th className="px-3 py-2">{labels.columns.verification}</th>
              <th className="px-3 py-2">{labels.columns.status}</th>
              <th className="px-3 py-2">{labels.columns.created}</th>
              <th className="px-3 py-2 text-right">{labels.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b app-border align-top">
                <td className="px-3 py-3">{nameCell(item)}</td>
                <td className="px-3 py-3 app-muted">{item.creatorLabel}</td>
                <td className="px-3 py-3 app-muted tabular-nums">{item.membersCount}</td>
                <td className="px-3 py-3 app-muted">{item.verificationLabel}</td>
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
            {nameCell(item)}
            <AdminCardMeta>
              {item.creatorLabel} · {item.createdAtLabel}
            </AdminCardMeta>
            <AdminCardMeta label={labels.columns.team}>{item.membersCount}</AdminCardMeta>
            <AdminCardMeta label={labels.columns.verification}>
              {item.verificationLabel}
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
