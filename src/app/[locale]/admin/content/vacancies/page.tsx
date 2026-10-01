import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminVacanciesTable from "@/components/admin/vacancies-table";
import { buildCompanyPath } from "@/lib/companies";
import { listVacanciesForAdmin, type AdminVacancyFilter } from "@/lib/db/vacancies";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { getModerationCopy } from "@/lib/moderation-copy";
import { buildMetadata } from "@/lib/seo";
import { buildVacancyPath } from "@/lib/vacancies";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS: AdminVacancyFilter[] = ["review", "open", "hidden", "all"];

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
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
    pathname: "/admin/content/vacancies",
    title: `${dictionary.vacancies.admin.title} · ${dictionary.admin.shell.title}`,
    description: dictionary.vacancies.admin.description,
    noindex: true,
  });
}

export default async function AdminVacanciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.includes(rawFilter as AdminVacancyFilter)
    ? (rawFilter as AdminVacancyFilter)
    : "review";

  const dictionary = getDictionary(locale);
  const copy = dictionary.vacancies;
  const ui = copy.admin;
  const moderationCopy = getModerationCopy(locale);
  // The layout already let only admins in; the session carries their rights.
  const viewer = await getCurrentViewerRole();
  const vacancies = await listVacanciesForAdmin(viewer.supabase, filter);

  const dateFormat = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
  });

  const items = vacancies.map((vacancy) => ({
    id: vacancy.id,
    title: vacancy.title,
    href: createLocalePath(locale, buildVacancyPath(vacancy.slug)),
    companyName: vacancy.company.name,
    companyHref: createLocalePath(locale, buildCompanyPath(vacancy.company.slug)),
    companyVerified: vacancy.company.verified,
    stateLabel: copy.states[vacancy.state],
    moderationStatus: vacancy.moderationStatus,
    moderationNote: vacancy.moderationNote,
    createdAtLabel: dateFormat.format(new Date(vacancy.createdAt)),
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8">
        <h2 className="font-display text-xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-2xl">
          {ui.title}
        </h2>
        <p className="mt-2 max-w-3xl app-muted">{ui.description}</p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label={ui.title}>
          {FILTERS.map((value) => {
            const active = value === filter;
            return (
              <Link
                key={value}
                href={createLocalePath(
                  locale,
                  value === "review"
                    ? "/admin/content/vacancies"
                    : `/admin/content/vacancies?filter=${value}`,
                )}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "app-border text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                {ui.filters[value]}
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="rounded-none app-card p-4 sm:rounded-hero sm:p-6">
        {items.length === 0 ? (
          <div className="rounded-3xl app-panel-dashed p-8 text-center">
            <p className="text-sm app-muted">{filter === "review" ? ui.emptyReview : ui.empty}</p>
          </div>
        ) : (
          <AdminVacanciesTable
            items={items}
            statusLabels={moderationCopy.statusLabels}
            labels={{
              columns: ui.columns,
              approve: ui.approve,
              open: ui.open,
              status: ui.status,
              verified: ui.verified,
              saved: ui.saved,
              error: ui.error,
            }}
          />
        )}
      </section>
    </div>
  );
}
