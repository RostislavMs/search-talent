import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminModerationActions from "@/components/admin-moderation-actions";
import { getModerationQueue } from "@/lib/db/moderation";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getModerationCopy } from "@/lib/moderation-copy";
import { buildMetadata } from "@/lib/seo";

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = getModerationCopy(locale);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/admin/moderation",
    title: `${dictionary.admin.nav.moderation} · ${dictionary.admin.shell.title}`,
    description: copy.dashboard.description,
    noindex: true,
  });
}

export default async function AdminModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const copy = getModerationCopy(locale);

  const queue = await getModerationQueue();

  if (!queue) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-8">
        <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
          {copy.dashboard.eyebrow}
        </p>
        <h2 className="font-display mt-3 text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.dashboard.title}
        </h2>
        <p className="mt-3 max-w-3xl app-muted">{copy.dashboard.description}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: copy.dashboard.reportsCount, value: queue.summary.active },
            { label: copy.dashboard.urgentCount, value: queue.summary.urgent },
            { label: copy.dashboard.profilesCount, value: queue.summary.profiles },
            { label: copy.dashboard.projectsCount, value: queue.summary.projects },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl app-panel p-5">
              <p className="text-sm app-soft">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">
                {item.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      {queue.items.length === 0 ? (
        <section className="rounded-hero app-panel-dashed p-8 text-center">
          <p className="text-sm app-muted">{copy.dashboard.empty}</p>
        </section>
      ) : (
        <section className="space-y-5">
          {queue.items.map((item) => (
            <article key={item.id} className="rounded-hero app-card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    <span>{copy.targetLabels[item.targetType]}</span>
                    <span className="rounded-full border border-[color:var(--border)] px-3 py-1">
                      {copy.priorityLabels[item.priority]}
                    </span>
                    <span className="rounded-full border border-[color:var(--border)] px-3 py-1">
                      {copy.reportStatusLabels[item.reportStatus]}
                    </span>
                  </div>

                  <h3 className="mt-4 text-2xl font-semibold text-[color:var(--foreground)]">
                    {item.targetLabel}
                  </h3>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm app-muted">
                    <span>
                      {copy.dashboard.reportReason}: {copy.reasonLabels[item.reportReason]}
                    </span>
                    <span>
                      {copy.dashboard.targetStatus}:{" "}
                      {item.targetStatus
                        ? copy.statusLabels[item.targetStatus]
                        : copy.statusLabels.approved}
                    </span>
                    <span>
                      {copy.dashboard.createdAt}: {formatDate(item.createdAt, locale)}
                    </span>
                  </div>

                  {item.details && (
                    <div className="mt-4 rounded-3xl app-panel p-4">
                      <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                        {copy.dashboard.reportDetails}
                      </p>
                      <p className="mt-3 text-sm leading-7 app-muted">{item.details}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-4 text-sm app-muted">
                    <span>
                      {copy.dashboard.reporter}: {item.reporterLabel}
                    </span>
                    <span>
                      {copy.dashboard.targetOwner}: {item.ownerLabel}
                    </span>
                  </div>

                  {item.targetHref && (
                    <div className="mt-4">
                      <Link
                        href={createLocalePath(locale, item.targetHref)}
                        className="text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                      >
                        {copy.dashboard.openTarget}
                      </Link>
                    </div>
                  )}
                </div>

                <div className="w-full lg:max-w-xl">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-eyebrow app-soft">
                    {copy.dashboard.reviewActions}
                  </p>
                  <AdminModerationActions
                    copy={copy}
                    targetType={item.targetType}
                    targetId={item.targetId}
                    currentStatus={item.targetStatus}
                    reportId={item.id}
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

    </div>
  );
}
