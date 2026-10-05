import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CompanyLogo from "@/components/company-logo";
import MySpaceChecklist from "@/components/my-space-checklist";
import MySpacePortfolioViews from "@/components/my-space-portfolio-views";
import MySpaceStats from "@/components/my-space-stats";
import OpenToCard from "@/components/open-to-card";
import ProfileCompletenessButton from "@/components/profile-completeness-button";
import ProfileSharePanel from "@/components/profile-share-panel";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { MY_APPLICATIONS_PATH } from "@/lib/applications";
import { buildLoginHref } from "@/lib/auth/redirect";
import { buildCompanyPath } from "@/lib/companies";
import { countMyApplications } from "@/lib/db/applications";
import { hasCompanyMembership } from "@/lib/db/companies";
import { listMyJobAlerts } from "@/lib/db/job-alerts";
import { getOnboardingSnapshot } from "@/lib/db/onboarding";
import { getMyContactOpenCompanies, getMyContactOpens } from "@/lib/db/open-to";
import { getMyPortfolioViews } from "@/lib/db/portfolio-views";
import { getUserStats } from "@/lib/db/stats";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { buildMetadata, getSiteUrl } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { isTemporaryUsername } from "@/lib/username";
import { formatCount } from "@/lib/vacancies";

async function getLocaleValue(params: Promise<{ locale: string }>) {
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
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/my-space",
    title: dictionary.metadata.mySpace.title,
    description: dictionary.metadata.mySpace.description,
    noindex: true,
  });
}

export default async function MySpacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, "/my-space"));
  }

  const dictionary = getDictionary(locale);
  const [
    viewer,
    userStats,
    onboarding,
    contactOpens,
    hasCompanies,
    applicationsCount,
    jobAlerts,
    openedByCompanies,
    portfolioViews,
  ] = await Promise.all([
    getCurrentViewerRole(),
    getUserStats(user.id),
    getOnboardingSnapshot(),
    getMyContactOpens(supabase),
    hasCompanyMembership(supabase, user.id),
    countMyApplications(supabase, user.id),
    listMyJobAlerts(supabase, user.id),
    getMyContactOpenCompanies(supabase),
    getMyPortfolioViews(supabase),
  ]);
  const profileAlert = jobAlerts.find((alert) => alert.target.type === "profile") ?? null;
  const companiesOpenedCopy = dictionary.openTo.companiesOpened;
  const applicationsCopy = dictionary.applications.mySpaceCard;
  const companiesCopy = dictionary.companies.mySpaceCard;
  const usernameHint = onboarding?.checklist.needsUsername
    ? isTemporaryUsername(onboarding.profile.username)
      ? dictionary.mySpace.usernameTemporary
      : dictionary.mySpace.usernameFromEmail
    : null;
  // Handing out an empty portfolio helps nobody; until the first project the
  // checklist points to the onboarding step instead.
  const shareUsername =
    onboarding && onboarding.publishedProjectsCount > 0 ? onboarding.profile.username : null;

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {dictionary.mySpace.title}
          </h1>
          <p className="mt-1 text-sm app-muted">
            {dictionary.mySpace.description}
          </p>
        </div>
        {onboarding ? (
          <ProfileCompletenessButton
            completeness={onboarding.completeness}
            locale={locale}
            editHref={`/${locale}/profile/edit`}
          />
        ) : null}
      </div>

      {onboarding ? (
        <div className="mb-8">
          <MySpaceChecklist
            checklist={onboarding.checklist}
            usernameHint={usernameHint}
            dictionary={dictionary}
          />
        </div>
      ) : null}

      {onboarding ? (
        <OpenToCard
          className="mb-8 rounded-hero app-card p-5 sm:p-6"
          initialOpenTo={onboarding.profile.open_to}
          initialUpdatedAt={onboarding.profile.open_to_updated_at}
          jobAlert={{ alertId: profileAlert?.id ?? null }}
        />
      ) : null}

      {openedByCompanies.length > 0 ? (
        <section className="mb-8 rounded-hero app-card p-5 sm:p-6" aria-labelledby="my-space-companies-opened">
          <h2
            id="my-space-companies-opened"
            className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
          >
            {companiesOpenedCopy.title}
          </h2>
          <p className="mt-1 text-sm app-muted">{companiesOpenedCopy.text}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {openedByCompanies.slice(0, 12).map((company) => (
              <li key={company.id}>
                <LocalizedLink
                  href={buildCompanyPath(company.slug)}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border app-border py-1 pl-1 pr-3 text-sm text-[color:var(--foreground)] transition-colors hover:border-[color:var(--foreground)]"
                >
                  <CompanyLogo name={company.name} logoUrl={company.logoUrl} alt="" size="xs" />
                  <span className="truncate">{company.name}</span>
                </LocalizedLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Once there is a portfolio to look at: before the first project the
          checklist above is the next step, not an empty chart. */}
      {portfolioViews && onboarding && onboarding.publishedProjectsCount > 0 ? (
        <MySpacePortfolioViews dictionary={dictionary} locale={locale} views={portfolioViews} />
      ) : null}

      {onboarding && shareUsername ? (
        <section className="mb-8 rounded-hero app-card p-5 sm:p-6" aria-labelledby="my-space-share">
          <h2
            id="my-space-share"
            className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
          >
            {dictionary.profileShare.cardTitle}
          </h2>
          <p className="mt-1 text-sm app-muted">{dictionary.profileShare.cardDescription}</p>
          <div className="mt-5">
            <ProfileSharePanel
              profileUrl={new URL(`/u/${shareUsername}`, getSiteUrl()).toString()}
              username={shareUsername}
              openTo={onboarding.profile.open_to}
              alreadyShared={
                onboarding.checklist.items.find((item) => item.key === "share")?.done ?? false
              }
              showBadge
              columns
            />
          </div>
        </section>
      ) : null}

      <MySpaceStats
        dictionary={dictionary}
        locale={locale}
        userStats={userStats}
        contactOpens={contactOpens}
        isAdmin={viewer.isAdmin}
      />

      {applicationsCount > 0 ? (
        <section
          className="mt-8 flex flex-col gap-3 rounded-hero app-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          aria-labelledby="my-space-applications"
        >
          <div>
            <h2
              id="my-space-applications"
              className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
            >
              {applicationsCopy.title}
            </h2>
            <p className="mt-1 text-sm app-muted">
              {applicationsCopy.text.replace(
                "{vacancies}",
                formatCount(applicationsCount, applicationsCopy.vacancies, locale),
              )}
            </p>
          </div>
          <ButtonLink href={MY_APPLICATIONS_PATH} variant="secondary" className="self-start sm:self-auto">
            {applicationsCopy.cta}
          </ButtonLink>
        </section>
      ) : null}

      {/* One quiet line, not a banner: most people here are specialists. */}
      <section
        className="mt-8 flex flex-col gap-3 rounded-hero app-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        aria-labelledby="my-space-companies"
      >
        <div>
          <h2
            id="my-space-companies"
            className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
          >
            {hasCompanies ? companiesCopy.mine : companiesCopy.title}
          </h2>
          {hasCompanies ? null : (
            <p className="mt-1 text-sm app-muted">{companiesCopy.text}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {hasCompanies ? (
            <ButtonLink href="/my-space/vacancies" variant="secondary">
              {companiesCopy.vacancies}
            </ButtonLink>
          ) : null}
          <ButtonLink
            href={hasCompanies ? "/my-space/companies" : "/companies/new"}
            variant="secondary"
          >
            {hasCompanies ? dictionary.common.open : companiesCopy.cta}
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
