import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JobAlertFollow from "@/components/job-alert-follow";
import JsonLd from "@/components/json-ld";
import VacancyCard from "@/components/vacancy-card";
import VacancyFilters from "@/components/vacancy-filters";
import { ButtonLink } from "@/components/ui/Button";
import Pagination from "@/components/ui/pagination";
import { buildLoginHref } from "@/lib/auth/redirect";
import { hasCompanyMembership } from "@/lib/db/companies";
import { listMyJobAlerts } from "@/lib/db/job-alerts";
import { getSectionVisibility } from "@/lib/db/section-visibility";
import { getJobsFilterOptions, listOpenVacancies } from "@/lib/db/vacancies";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildItemListSchema, buildMetadata, getMetadataBase, toBcp47 } from "@/lib/seo";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { sameJobAlertFilters, withoutPage } from "@/lib/job-alerts";
import {
  JOBS_PAGE_SIZE,
  JOBS_PATH,
  buildJobsHref,
  buildVacancyPath,
  formatCount,
  hasVacancyFilters,
  parseVacancyFilters,
} from "@/lib/vacancies";

// Filters live in the address and the list is rendered here, on the server:
// /api is closed to crawlers, so a list fetched in the browser would be empty
// to them (see project-discovery-ssr-soft404).
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = getDictionary(locale).vacancies.meta;
  const [filters, sections] = await Promise.all([
    searchParams.then(parseVacancyFilters),
    getSectionVisibility(),
  ]);

  return buildMetadata({
    locale,
    pathname: JOBS_PATH,
    title: copy.listTitle,
    absoluteTitle: true,
    description: copy.listDescription,
    // Until the section is in the menu there is too little here to show in
    // search; filtered and further pages are versions of the same list.
    noindex: !sections.jobs || hasVacancyFilters(filters) || filters.page > 1,
  });
}

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const locale = await resolveLocale(params);
  const filters = parseVacancyFilters(await searchParams);
  const dictionary = getDictionary(locale);
  const copy = dictionary.vacancies;

  // What a visitor sees, whoever is looking: the public client, so a team
  // member's drafts never mix into the list.
  const supabase = createPublicReadOnlyClient() ?? (await createClient());
  const user = await getCurrentUser();
  const session = user ? await createClient() : null;

  const [{ items, total }, options, sections, isMember, alerts] = await Promise.all([
    listOpenVacancies(supabase, filters),
    getJobsFilterOptions(supabase),
    getSectionVisibility(),
    user && session ? hasCompanyMembership(session, user.id) : Promise.resolve(false),
    user && session ? listMyJobAlerts(session, user.id) : Promise.resolve([]),
  ]);

  const followedFilters = withoutPage(filters);
  const followedAlert = alerts.find(
    (alert) => alert.target.type === "filters" && sameJobAlertFilters(alert.target.filters, followedFilters),
  );

  const totalPages = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  const filtered = hasVacancyFilters(filters);
  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");

  const cta = isMember
    ? { href: "/jobs/new", label: copy.list.postCta }
    : { href: "/for-companies", label: copy.list.forCompaniesCta };

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      {sections.jobs && !filtered && filters.page === 1 && items.length > 0 ? (
        <JsonLd
          data={buildItemListSchema({
            url: `${siteUrl}/${locale}${JOBS_PATH}`,
            name: copy.meta.listTitle,
            inLanguage: toBcp47(locale),
            items: items.map((vacancy) => ({
              url: `${siteUrl}/${locale}${buildVacancyPath(vacancy.slug)}`,
              name: vacancy.title,
            })),
          })}
        />
      ) : null}

      <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8 md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
              {copy.list.eyebrow}
            </p>
            <h1 className="font-display mt-3 text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {copy.list.title}
            </h1>
            <p className="mt-4 text-base leading-8 app-muted">{copy.list.intro}</p>
          </div>
          <ButtonLink href={cta.href} variant="secondary" className="self-start lg:self-end">
            {cta.label}
          </ButtonLink>
        </div>

        <div className="mt-8 border-t app-border pt-6">
          <VacancyFilters
            filters={filters}
            countries={options.countries}
            categories={options.categories}
            skills={options.skills}
          />
        </div>
      </section>

      <section className="mt-6 sm:mt-8" aria-labelledby="jobs-results">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-0">
          {/* With nothing found the empty card says it; "0 positions" above it would repeat. */}
          <h2
            id="jobs-results"
            className={total > 0 ? "text-sm font-medium app-muted" : "sr-only"}
          >
            {total > 0 ? formatCount(total, copy.list.count, locale) : copy.list.title}
          </h2>
          <div className="ml-auto">
            <JobAlertFollow
              filters={followedFilters}
              alertId={followedAlert?.id ?? null}
              isAuthenticated={Boolean(user)}
              loginHref={buildLoginHref(locale, buildJobsHref(followedFilters))}
            />
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((vacancy) => (
              <VacancyCard key={vacancy.id} vacancy={vacancy} dictionary={dictionary} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-none app-card p-6 sm:rounded-panel sm:p-8">
            <p className="text-base font-medium text-[color:var(--foreground)]">
              {filtered ? copy.list.emptyFiltered : copy.list.empty}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">
              {filtered ? copy.list.emptyFilteredHint : copy.list.emptyHint}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {filtered ? (
                <ButtonLink href={JOBS_PATH} variant="secondary" size="sm">
                  {copy.list.filters.reset}
                </ButtonLink>
              ) : null}
              <ButtonLink href="/talents" variant="ghost" size="sm">
                {copy.list.browseTalents}
              </ButtonLink>
            </div>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-8 flex justify-center">
            <Pagination
              currentPage={Math.min(filters.page, totalPages)}
              totalPages={totalPages}
              ariaLabel={copy.list.pagination}
              hrefFor={(page) => createLocalePath(locale, buildJobsHref({ ...filters, page }))}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
