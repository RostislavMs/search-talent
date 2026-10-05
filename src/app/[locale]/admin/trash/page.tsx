import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TrashItemActions from "@/components/admin/trash-item-actions";
import { TRASH_PAGE_SIZE, listTrashItems } from "@/lib/db/trash";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { TRASH_KINDS, isTrashKind, type TrashKind } from "@/lib/trash";

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
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
    pathname: "/admin/trash",
    title: `${dictionary.admin.trash.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.admin.trash.description,
    noindex: true,
  });
}

export default async function AdminTrashPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const locale = await resolveLocale(params);
  const resolved = await searchParams;
  const copy = getDictionary(locale).admin.trash;

  const kindParam = firstValue(resolved.kind);
  const kind: TrashKind | null = isTrashKind(kindParam) ? kindParam : null;
  const pageParam = Number.parseInt(firstValue(resolved.page) ?? "0", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 0;

  const supabase = await createClient();
  // Pages before the current one are shown too, so "Show more" grows the list.
  const items = await listTrashItems(supabase, { kind, offset: 0, limit: (page + 1) * TRASH_PAGE_SIZE });
  const hasMore = items !== null && items.length === (page + 1) * TRASH_PAGE_SIZE;

  function buildHref(next: { kind?: TrashKind | null; page?: number }) {
    const qs = new URLSearchParams();
    const nextKind = next.kind === undefined ? kind : next.kind;
    if (nextKind) qs.set("kind", nextKind);
    if (next.page) qs.set("page", String(next.page));
    const path = createLocalePath(locale, "/admin/trash");
    const query = qs.toString();
    return query ? `${path}?${query}` : path;
  }

  const actionLabels = {
    restore: copy.restore,
    restoring: copy.restoring,
    erase: copy.erase,
    erasing: copy.erasing,
    restoreTitle: copy.restoreTitle,
    restoreMessage: copy.restoreMessage,
    restoreAccountMessage: copy.restoreAccountMessage,
    eraseTitle: copy.eraseTitle,
    eraseMessage: copy.eraseMessage,
    eraseAccountMessage: copy.eraseAccountMessage,
    cancel: copy.cancel,
    errors: copy.errors,
  };

  return (
    <div className="space-y-6">
      <section className="rounded-none sm:rounded-hero app-card p-5 sm:p-8">
        <h2 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
          {copy.title}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{copy.description}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center text-sm app-muted">{copy.filterLabel}:</span>
          {[null, ...TRASH_KINDS].map((value) => {
            const active = value === kind;
            return (
              <Link
                key={value ?? "all"}
                href={buildHref({ kind: value, page: 0 })}
                className={[
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)]",
                ].join(" ")}
              >
                {value ? copy.kinds[value] : copy.filterAll}
              </Link>
            );
          })}
        </div>
      </section>

      {items === null ? (
        <section className="rounded-none sm:rounded-hero app-panel-dashed p-8 text-center">
          <p className="text-sm app-muted">{copy.unavailable}</p>
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-none sm:rounded-hero app-panel-dashed p-8 text-center">
          <p className="text-sm app-muted">{copy.empty}</p>
        </section>
      ) : (
        <section className="space-y-4">
          {items.map((item) => (
            <article
              key={item.groupId}
              className="flex flex-col gap-4 rounded-none sm:rounded-3xl app-card p-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                  {copy.kindSingular[item.kind]}
                </p>
                <h3 className="break-words font-medium text-[color:var(--foreground)]">
                  {item.summary || copy.untitled}
                </h3>
                <p className="text-sm app-muted">
                  {[
                    item.ownerUsername && item.kind !== "account"
                      ? `${copy.owner}: @${item.ownerUsername}`
                      : null,
                    item.accountEmail,
                    copy.reasons[item.reason],
                    item.deletedByUsername && item.reason === "admin"
                      ? fill(copy.deletedBy, { username: item.deletedByUsername })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-sm app-soft">
                  {[
                    fill(copy.deletedAt, { date: formatDate(item.deletedAt, locale) }),
                    fill(copy.purgeAt, { date: formatDate(item.purgeAfter, locale) }),
                    item.relatedCount > 0 ? fill(copy.related, { count: item.relatedCount }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="shrink-0">
                <TrashItemActions
                  groupId={item.groupId}
                  isAccount={item.kind === "account"}
                  labels={actionLabels}
                />
              </div>
            </article>
          ))}
          {hasMore ? (
            <div className="flex justify-center">
              <Link
                href={buildHref({ page: page + 1 })}
                className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
              >
                {copy.more}
              </Link>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
