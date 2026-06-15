import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommentsTableClient from "@/components/admin/comments-table-client";
import { buttonStyles } from "@/components/ui/button-styles";
import { getAdminCommentsList } from "@/lib/db/admin-content";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
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
    pathname: "/admin/content/comments",
    title: `${dictionary.admin.content.commentsTitle} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.content.commentsDescription,
    noindex: true,
  });
}

export default async function AdminCommentsContentPage({
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

  const kindParam = firstValue(resolvedSearchParams.kind);
  const pageParam = Number.parseInt(
    firstValue(resolvedSearchParams.page) || "1",
    10,
  );

  const kind: "all" | "article" | "project" =
    kindParam === "article" || kindParam === "project" ? kindParam : "all";

  const result = await getAdminCommentsList({
    kind,
    page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
    perPage: PER_PAGE,
  });

  const pageCount = Math.max(1, Math.ceil(result.total / result.perPage));

  function buildFilterHref(nextKind: "all" | "article" | "project") {
    const qs = new URLSearchParams();
    if (nextKind !== "all") qs.set("kind", nextKind);
    const query = qs.toString();
    const path = createLocalePath(locale, "/admin/content/comments");
    return query ? `${path}?${query}` : path;
  }

  function buildPageHref(nextPage: number) {
    const qs = new URLSearchParams();
    if (kind !== "all") qs.set("kind", kind);
    if (nextPage > 1) qs.set("page", String(nextPage));
    const query = qs.toString();
    const path = createLocalePath(locale, "/admin/content/comments");
    return query ? `${path}?${query}` : path;
  }

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  const filterChips: Array<{
    value: "all" | "article" | "project";
    label: string;
  }> = [
    { value: "all", label: copy.filterAll },
    { value: "article", label: copy.typeArticle },
    { value: "project", label: copy.typeProject },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-5 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.commentsTitle}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{copy.commentsDescription}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center text-sm app-muted">
            {copy.filterType}:
          </span>
          {filterChips.map((chip) => {
            const active = chip.value === kind;
            return (
              <Link
                key={chip.value}
                href={buildFilterHref(chip.value)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)]",
                ].join(" ")}
              >
                {chip.label}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-hero app-card p-4 sm:p-6">
        {result.items.length === 0 ? (
          <div className="rounded-3xl app-panel-dashed p-8 text-center">
            <p className="text-sm app-muted">{copy.empty}</p>
          </div>
        ) : (
          <CommentsTableClient
            items={result.items.map((comment) => ({
              id: comment.id,
              kind: comment.kind,
              body: comment.body,
              kindLabel:
                comment.kind === "article"
                  ? copy.typeArticle
                  : copy.typeProject,
              authorLabel: comment.authorLabel,
              authorHref: comment.authorHref
                ? createLocalePath(locale, comment.authorHref)
                : null,
              targetLabel: comment.targetLabel,
              targetHref: comment.targetHref
                ? createLocalePath(locale, comment.targetHref)
                : null,
              createdAtLabel: formatDate(comment.createdAt),
            }))}
            columnLabels={copy.commentColumns}
            bulkLabels={{
              selected: copy.bulkBar.selected,
              clear: copy.bulkBar.clear,
              bulkDelete: copy.bulkBar.bulkDelete,
              applying: copy.bulkBar.applying,
              confirmTitle: copy.confirmDeleteCommentTitle,
              confirmMessage: copy.confirmDeleteCommentMessage,
              confirmButton: copy.confirmBulkButton,
              cancel: copy.cancel,
              errorFallback: copy.errorFallback,
            }}
            rowDeleteLabels={{
              delete: copy.bulkBar.bulkDelete,
              deleting: copy.bulkBar.applying,
              confirmTitle: copy.confirmDeleteCommentTitle,
              confirmMessage: copy.confirmDeleteCommentMessage,
              confirmButton: copy.confirmBulkButton,
              cancel: copy.cancel,
              errorFallback: copy.errorFallback,
            }}
            selectAllLabel={locale === "uk" ? "Обрати всі" : "Select all"}
            selectRowLabel={
              locale === "uk" ? "Обрати коментар" : "Select comment"
            }
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
