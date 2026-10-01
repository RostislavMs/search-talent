import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import VacancyStatusActions from "@/components/vacancy-status-actions";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { buildLoginHref } from "@/lib/auth/redirect";
import { canEditCompany } from "@/lib/companies";
import { listMyCompanies } from "@/lib/db/companies";
import { listTeamVacancies, type TeamVacancy } from "@/lib/db/vacancies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { buildVacancyPath, formatCount } from "@/lib/vacancies";
import { formatVacancyDate } from "@/lib/vacancy-presentation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const copy = getDictionary(locale).vacancies.meta;

  return buildMetadata({
    locale,
    pathname: "/my-space/vacancies",
    title: copy.mineTitle,
    description: copy.mineDescription,
    noindex: true,
  });
}

/** One line under the title: where the vacancy stands, in plain words. */
function StatusLine({
  vacancy,
  copy,
  locale,
}: {
  vacancy: TeamVacancy;
  copy: Dictionary["vacancies"];
  locale: Locale;
}) {
  if (vacancy.moderationStatus === "under_review" && vacancy.state !== "draft") {
    return <span className="text-xs font-medium text-amber-600">{copy.mine.underReview}</span>;
  }

  if (vacancy.moderationStatus !== "approved") {
    return <span className="text-xs font-medium text-rose-600">{copy.mine.hidden}</span>;
  }

  if (vacancy.state === "open") {
    const until = formatVacancyDate(vacancy.expiresAt, locale);
    return (
      <span className="text-xs app-soft">
        {copy.states.open}
        {until ? ` · ${copy.mine.until.replace("{date}", until)}` : ""}
      </span>
    );
  }

  return <span className="text-xs app-soft">{copy.states[vacancy.state]}</span>;
}

export default async function MyVacanciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocale(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, "/my-space/vacancies"));
  }

  const copy = getDictionary(locale).vacancies;
  const companies = await listMyCompanies(supabase, user.id);
  const vacancies = await listTeamVacancies(
    supabase,
    companies.map((company) => company.id),
  );
  const roleByCompany = new Map(companies.map((company) => [company.id, company.role]));
  const canPost = companies.some((company) => company.moderationStatus === "approved");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {copy.mine.title}
          </h1>
          <p className="mt-1 text-sm app-muted">{copy.mine.description}</p>
        </div>
        {canPost ? <ButtonLink href="/jobs/new">{copy.mine.create}</ButtonLink> : null}
      </div>

      {companies.length === 0 ? (
        <section className="rounded-hero app-card p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.form.noCompanyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.form.noCompanyText}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/companies/new">{copy.form.noCompanyCta}</ButtonLink>
            <ButtonLink href="/for-companies" variant="secondary">
              {copy.form.noCompanyLearnMore}
            </ButtonLink>
          </div>
        </section>
      ) : vacancies.length === 0 ? (
        <section className="rounded-hero app-card p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.mine.emptyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.mine.emptyText}</p>
          {canPost ? (
            <div className="mt-5">
              <ButtonLink href="/jobs/new">{copy.mine.create}</ButtonLink>
            </div>
          ) : null}
        </section>
      ) : (
        <ul className="space-y-3">
          {vacancies.map((vacancy) => {
            const role = roleByCompany.get(vacancy.company.id) ?? null;
            return (
              <li
                key={vacancy.id}
                className="flex flex-col gap-4 rounded-hero app-card p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-display text-lg font-semibold text-[color:var(--foreground)]">
                    <LocalizedLink
                      href={buildVacancyPath(vacancy.slug)}
                      className="transition-colors hover:text-[color:var(--brand)]"
                    >
                      {vacancy.title}
                    </LocalizedLink>
                  </p>
                  <p className="text-sm app-muted">
                    {vacancy.company.name}
                    {vacancy.views !== null && vacancy.state !== "draft"
                      ? ` · ${formatCount(vacancy.views, copy.mine.views, locale)}`
                      : ""}
                  </p>
                  <StatusLine vacancy={vacancy} copy={copy} locale={locale} />
                </div>
                <div className="shrink-0">
                  <VacancyStatusActions
                    vacancyId={vacancy.id}
                    title={vacancy.title}
                    status={vacancy.status}
                    expiresAt={vacancy.expiresAt}
                    canDelete={canEditCompany(role) || vacancy.authorUserId === user.id}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
