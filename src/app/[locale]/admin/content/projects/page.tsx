import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ContentFilterBar from "@/components/admin/content-filter-bar";
import ProjectsTableClient from "@/components/admin/projects-table-client";
import { buttonStyles } from "@/components/ui/button-styles";
import { getAdminProjectsList } from "@/lib/db/admin-content";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { ModerationStatus } from "@/lib/moderation";
import { getModerationCopy } from "@/lib/moderation-copy";
import { buildMetadata } from "@/lib/seo";

const PER_PAGE = 25;
type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
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
    pathname: "/admin/content/projects",
    title: `${dictionary.admin.content.projectsTitle} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.content.projectsDescription,
    noindex: true,
  });
}

export default async function AdminProjectsContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const locale = await resolveLocale(params);
  const resolvedSearchParams = await searchParams;
  const dictionary = getDictionary(locale);
  const copy = dictionary.admin.content;
  const moderationCopy = getModerationCopy(locale);

  const search = firstValue(resolvedSearchParams.q) || "";
  const statusParam = firstValue(resolvedSearchParams.status);
  const pageParam = Number.parseInt(
    firstValue(resolvedSearchParams.page) || "1",
    10,
  );

  const status: "all" | ModerationStatus =
    statusParam === "approved" ||
    statusParam === "under_review" ||
    statusParam === "restricted" ||
    statusParam === "removed"
      ? (statusParam as ModerationStatus)
      : "all";

  const result = await getAdminProjectsList({
    search,
    status,
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    perPage: PER_PAGE,
  });

  const pageCount = Math.max(1, Math.ceil(result.total / result.perPage));

  function buildPageHref(nextPage: number) {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (status !== "all") qs.set("status", status);
    if (nextPage > 1) qs.set("page", String(nextPage));
    const query = qs.toString();
    const path = createLocalePath(locale, "/admin/content/projects");
    return query ? `${path}?${query}` : path;
  }

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
        dateStyle: "medium",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function buildStatusHref(next: "all" | ModerationStatus) {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (next !== "all") qs.set("status", next);
    const query = qs.toString();
    const path = createLocalePath(locale, "/admin/content/projects");
    return query ? `${path}?${query}` : path;
  }

  const statusChips: Array<{
    value: "all" | ModerationStatus;
    label: string;
    count: number;
  }> = [
    {
      value: "all",
      label: copy.filterAll,
      count:
        result.statusCounts.approved +
        result.statusCounts.under_review +
        result.statusCounts.restricted +
        result.statusCounts.removed,
    },
    {
      value: "approved",
      label: copy.filterApproved,
      count: result.statusCounts.approved,
    },
    {
      value: "under_review",
      label: copy.filterUnderReview,
      count: result.statusCounts.under_review,
    },
    {
      value: "restricted",
      label: copy.filterRestricted,
      count: result.statusCounts.restricted,
    },
    {
      value: "removed",
      label: copy.filterRemoved,
      count: result.statusCounts.removed,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-8">
        <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.projectsTitle}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{copy.projectsDescription}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {statusChips.map((chip) => {
            const active = chip.value === status;
            return (
              <Link
                key={chip.value}
                href={buildStatusHref(chip.value)}
                className={[
                  "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)]",
                ].join(" ")}
              >
                <span>{chip.label}</span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    active
                      ? "bg-[color:var(--background)]/20 text-[color:var(--background)]"
                      : "app-panel text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  {chip.count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-6">
          <ContentFilterBar
            labels={{
              searchPlaceholder: copy.searchPlaceholder,
              filterStatus: copy.filterStatus,
              filterAll: copy.filterAll,
              filterApproved: copy.filterApproved,
              filterUnderReview: copy.filterUnderReview,
              filterRestricted: copy.filterRestricted,
              filterRemoved: copy.filterRemoved,
            }}
          />
        </div>
      </section>

      <section className="rounded-hero app-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
            {result.total} · {copy.columns.title.toLowerCase()}
          </p>
          <p className="text-xs app-soft">
            {dictionary.admin.users.pagination.page} {result.page}{" "}
            {dictionary.admin.users.pagination.of} {pageCount}
          </p>
        </div>
        {result.items.length === 0 ? (
          <div className="rounded-3xl app-panel-dashed p-8 text-center">
            <p className="text-sm app-muted">{copy.empty}</p>
          </div>
        ) : (
          <ProjectsTableClient
            items={result.items.map((item) => ({
              id: item.id,
              title: item.title,
              href: createLocalePath(locale, item.path),
              authorLabel: item.authorLabel,
              authorHref: item.authorHref
                ? createLocalePath(locale, item.authorHref)
                : null,
              moderationStatus: item.moderationStatus,
              createdAtLabel: formatDate(item.createdAt),
              likes: item.likes,
              dislikes: item.dislikes,
            }))}
            statusLabels={moderationCopy.statusLabels}
            columnLabels={{
              title: copy.columns.title,
              author: copy.columns.author,
              status: copy.columns.status,
              created: copy.columns.created,
              engagement: copy.columns.engagement,
              actions: copy.columns.actions,
            }}
            openLabel={copy.openItem}
            locale={locale}
            redirectAfterDelete={createLocalePath(
              locale,
              "/admin/content/projects",
            )}
            bulkLabels={{
              selected: copy.bulkBar.selected,
              clear: copy.bulkBar.clear,
              bulkApprove: copy.bulkBar.bulkApprove,
              bulkHide: copy.bulkBar.bulkHide,
              bulkRestrict: copy.bulkBar.bulkRestrict,
              bulkDelete: copy.bulkBar.bulkDelete,
              applying: copy.bulkBar.applying,
              confirmTitle: copy.confirmBulkTitle,
              confirmMessage: copy.confirmBulkMessage,
              confirmButton: copy.confirmBulkButton,
              cancel: copy.cancel,
              errorFallback: copy.errorFallback,
            }}
          />
        )}

        {pageCount > 1 ? (
          <nav className="mt-6 flex items-center justify-between gap-3 text-sm app-muted">
            <span>
              {dictionary.admin.users.pagination.page} {result.page}{" "}
              {dictionary.admin.users.pagination.of} {pageCount}
            </span>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link
                  href={buildPageHref(result.page - 1)}
                  className={buttonStyles({ variant: "ghost", size: "sm" })}
                >
                  {dictionary.admin.users.pagination.previous}
                </Link>
              ) : null}
              {result.hasMore ? (
                <Link
                  href={buildPageHref(result.page + 1)}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  {dictionary.admin.users.pagination.next}
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
