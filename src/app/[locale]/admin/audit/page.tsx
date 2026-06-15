import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AuditFilterBar from "@/components/admin/audit-filter-bar";
import {
  AdminCard,
  AdminCardList,
  AdminCardMeta,
} from "@/components/admin/admin-mobile-cards";
import { buttonStyles } from "@/components/ui/button-styles";
import { getAdminAuditLog } from "@/lib/db/admin";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getModerationCopy } from "@/lib/moderation-copy";
import { reportTargetTypes, type ReportTargetType } from "@/lib/moderation";
import { buildMetadata } from "@/lib/seo";

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return locale;
}

function formatDateTime(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  return buildMetadata({
    locale,
    pathname: "/admin/audit",
    title: `${dictionary.admin.audit.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.audit.description,
    noindex: true,
  });
}

const ACTION_VALUES = [
  "approve",
  "restore",
  "send_to_review",
  "restrict",
  "remove",
  "update_status",
  "confirm_approved",
] as const;

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const locale = await resolveLocale(params);
  const dictionary = getDictionary(locale);
  const resolvedSearchParams = await searchParams;
  const copy = dictionary.admin.audit;
  const moderationCopy = getModerationCopy(locale);

  const actionParam = firstValue(resolvedSearchParams.action);
  const targetParam = firstValue(resolvedSearchParams.target);
  const beforeParam = firstValue(resolvedSearchParams.before);

  const action =
    actionParam &&
    (ACTION_VALUES as readonly string[]).includes(actionParam)
      ? actionParam
      : "all";
  const target =
    targetParam && (reportTargetTypes as readonly string[]).includes(targetParam)
      ? (targetParam as ReportTargetType)
      : "all";

  const result = await getAdminAuditLog({
    action,
    target,
    before: beforeParam || null,
    limit: 50,
  });

  function buildLoadMoreHref(nextBefore: string) {
    const qs = new URLSearchParams();
    if (action !== "all") qs.set("action", action);
    if (target !== "all") qs.set("target", target);
    qs.set("before", nextBefore);
    return `${createLocalePath(locale, "/admin/audit")}?${qs.toString()}`;
  }

  const actionOptions = ACTION_VALUES.map((value) => ({
    value,
    label:
      (copy.actionLabels as Record<string, string>)[value] || value,
  }));
  const targetOptions = reportTargetTypes.map((value) => ({
    value,
    label: moderationCopy.targetLabels[value],
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-5 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{copy.description}</p>
        <div className="mt-6">
          <AuditFilterBar
            labels={{
              action: copy.filterAction,
              target: copy.filterTarget,
              all: copy.filterAll,
            }}
            actionOptions={actionOptions}
            targetOptions={targetOptions}
          />
        </div>
      </section>

      <section className="rounded-hero app-card p-4 sm:p-6">
        {result.items.length === 0 ? (
          <div className="rounded-3xl app-panel-dashed p-8 text-center">
            <p className="text-sm app-muted">{copy.empty}</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-eyebrow app-soft">
                  <th className="px-3 py-3">{copy.columns.when}</th>
                  <th className="px-3 py-3">{copy.columns.actor}</th>
                  <th className="px-3 py-3">{copy.columns.action}</th>
                  <th className="px-3 py-3">{copy.columns.target}</th>
                  <th className="px-3 py-3">{copy.columns.statusChange}</th>
                  <th className="px-3 py-3">{copy.columns.note}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((entry) => {
                  const actionLabel =
                    (copy.actionLabels as Record<string, string>)[entry.actionType] ||
                    entry.actionType;
                  const previous = entry.previousStatus
                    ? moderationCopy.statusLabels[entry.previousStatus]
                    : null;
                  const next = entry.nextStatus
                    ? moderationCopy.statusLabels[entry.nextStatus]
                    : null;

                  return (
                    <tr
                      key={entry.id}
                      className="border-t border-[color:var(--border)] align-top"
                    >
                      <td className="px-3 py-3 whitespace-nowrap app-muted">
                        {formatDateTime(entry.createdAt, locale)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium text-[color:var(--foreground)]">
                          {entry.actorLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                          {actionLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs uppercase tracking-eyebrow app-soft">
                            {moderationCopy.targetLabels[entry.targetType]}
                          </span>
                          {entry.targetHref ? (
                            <Link
                              href={createLocalePath(locale, entry.targetHref)}
                              className="font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                            >
                              {entry.targetLabel}
                            </Link>
                          ) : (
                            <span className="text-[color:var(--foreground)]">
                              {entry.targetLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 app-muted">
                        {previous && next
                          ? `${previous} → ${next}`
                          : next || previous || "—"}
                      </td>
                      <td className="px-3 py-3 app-muted">
                        {entry.note ? (
                          <span className="block max-w-sm whitespace-pre-wrap">
                            {entry.note}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <AdminCardList>
            {result.items.map((entry) => {
              const actionLabel =
                (copy.actionLabels as Record<string, string>)[entry.actionType] ||
                entry.actionType;
              const previous = entry.previousStatus
                ? moderationCopy.statusLabels[entry.previousStatus]
                : null;
              const next = entry.nextStatus
                ? moderationCopy.statusLabels[entry.nextStatus]
                : null;

              return (
                <AdminCard key={entry.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold">
                      {actionLabel}
                    </span>
                    <span className="text-xs app-soft">
                      {formatDateTime(entry.createdAt, locale)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <AdminCardMeta label={copy.columns.actor}>
                      {entry.actorLabel}
                    </AdminCardMeta>
                    <AdminCardMeta
                      label={moderationCopy.targetLabels[entry.targetType]}
                    >
                      {entry.targetHref ? (
                        <Link
                          href={createLocalePath(locale, entry.targetHref)}
                          className="text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                        >
                          {entry.targetLabel}
                        </Link>
                      ) : (
                        entry.targetLabel
                      )}
                    </AdminCardMeta>
                    <AdminCardMeta label={copy.columns.statusChange}>
                      {previous && next
                        ? `${previous} → ${next}`
                        : next || previous || "—"}
                    </AdminCardMeta>
                    {entry.note ? (
                      <AdminCardMeta label={copy.columns.note}>
                        <span className="whitespace-pre-wrap">{entry.note}</span>
                      </AdminCardMeta>
                    ) : null}
                  </div>
                </AdminCard>
              );
            })}
          </AdminCardList>
          </>
        )}

        {result.hasMore && result.items.length > 0 ? (
          <div className="mt-6 flex justify-center">
            <Link
              href={buildLoadMoreHref(
                result.items[result.items.length - 1].createdAt,
              )}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              {copy.loadMore}
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
