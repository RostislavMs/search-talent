import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import CompanyLogo from "@/components/company-logo";
import CompanyVerifiedBadge from "@/components/company-verified-badge";
import ContentReportButton from "@/components/content-report-button";
import JsonLd from "@/components/json-ld";
import RichTextRenderer from "@/components/rich-text-renderer";
import VacancyCard from "@/components/vacancy-card";
import VacancyStatusActions from "@/components/vacancy-status-actions";
import ViewBeacon from "@/components/view-beacon";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import {
  buildCompanyPath,
  canEditCompany,
  formatCompanyWebsiteLabel,
} from "@/lib/companies";
import { getCompanyById, getCompanyRole } from "@/lib/db/companies";
import { getVacancyBySlug, listCompanyOpenVacancies } from "@/lib/db/vacancies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getModerationCopy } from "@/lib/moderation-copy";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import {
  buildBreadcrumbSchema,
  buildJobPostingSchema,
  buildMetadata,
  composeSeoTitle,
  getMetadataBase,
  toBcp47,
} from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import {
  JOBS_PATH,
  buildVacancyPath,
  isVacancyIndexable,
  vacancyEmploymentTypes,
  vacancyKindHasHours,
  type VacancyDetails,
} from "@/lib/vacancies";
import {
  formatVacancyDate,
  vacancyPayLabel,
  vacancyPlaceLabel,
} from "@/lib/vacancy-presentation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ locale: string; slug: string }>;

async function resolveParams(params: RouteParams): Promise<{ locale: Locale; slug: string }> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  // A malformed escape ("%E0%A4") is a missing page, not a server error.
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug).toLowerCase();
  } catch {
    notFound();
  }
  return { locale, slug: decoded };
}

// One read per request, shared by the metadata and the page.
const loadVacancy = cache(async (slug: string) => {
  const supabase = await createClient();
  return getVacancyBySlug(supabase, slug);
});

function metaDescription(vacancy: VacancyDetails, dictionary: Dictionary, locale: Locale) {
  const copy = dictionary.vacancies;
  const facts = [
    copy.kinds[vacancy.kind],
    vacancyPlaceLabel(vacancy, copy),
    vacancyPayLabel(vacancy, copy, locale),
  ].filter(Boolean);
  const lead = copy.page.metaDescription
    .replace("{title}", vacancy.title)
    .replace("{company}", vacancy.company.name)
    .replace("{facts}", facts.join(", "));
  const text = `${lead} ${extractPlainTextFromRichText(vacancy.description)}`.replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, slug } = await resolveParams(params);
  const dictionary = getDictionary(locale);
  const vacancy = await loadVacancy(slug);

  if (!vacancy) {
    return buildMetadata({
      locale,
      pathname: buildVacancyPath(slug),
      title: dictionary.vacancies.page.eyebrow,
      description: dictionary.vacancies.meta.listDescription,
      noindex: true,
    });
  }

  return buildMetadata({
    locale,
    pathname: buildVacancyPath(vacancy.slug),
    title: composeSeoTitle(locale, `${vacancy.title} — ${vacancy.company.name}`),
    absoluteTitle: true,
    description: metaDescription(vacancy, dictionary, locale),
    // A vacancy is written in one language; the other locale only frames it.
    hreflangLocales: [vacancy.locale],
    noindex: !isVacancyIndexable(vacancy) || vacancy.locale !== locale,
  });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{label}</dt>
      <dd className="mt-1 text-sm text-[color:var(--foreground)]">{value}</dd>
    </div>
  );
}

export default async function VacancyPage({ params }: { params: RouteParams }) {
  const { locale, slug } = await resolveParams(params);
  const vacancy = await loadVacancy(slug);

  if (!vacancy) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const copy = dictionary.vacancies;
  const viewer = await getCurrentViewerRole();
  const [role, company, more] = await Promise.all([
    getCompanyRole(viewer.supabase, vacancy.company.id, viewer.user?.id),
    getCompanyById(viewer.supabase, vacancy.company.id),
    listCompanyOpenVacancies(viewer.supabase, vacancy.company.id, { limit: 4 }),
  ]);
  const isTeam = Boolean(role);
  const otherVacancies = more.filter((item) => item.id !== vacancy.id).slice(0, 3);

  const state = vacancy.state;
  const notice =
    isTeam || viewer.isAdmin
      ? state === "draft"
        ? copy.page.draftNotice
        : vacancy.moderationStatus === "under_review"
          ? copy.page.underReview
          : vacancy.moderationStatus !== "approved"
            ? copy.page.hidden
            : null
      : null;
  const closedNotice =
    state === "closed" ? copy.page.closedNotice : state === "expired" ? copy.page.expiredNotice : null;

  const pay = vacancyPayLabel(vacancy, copy, locale);
  const place = vacancyPlaceLabel(vacancy, copy);
  type FactRow = { label: string; value: string };
  const facts = ([
    { label: copy.page.facts.kind, value: copy.kinds[vacancy.kind] },
    vacancy.hours && vacancyKindHasHours(vacancy.kind)
      ? { label: copy.page.facts.hours, value: copy.hours[vacancy.hours] }
      : null,
    vacancy.workFormats.length > 0
      ? {
          label: copy.page.facts.format,
          value: vacancy.workFormats.map((format) => copy.formats[format]).join(", "),
        }
      : null,
    place ? { label: copy.page.facts.place, value: place } : null,
    vacancy.experienceLevel
      ? { label: copy.page.facts.level, value: copy.levels[vacancy.experienceLevel] }
      : null,
    vacancy.categoryName ? { label: copy.page.facts.role, value: vacancy.categoryName } : null,
    { label: copy.page.facts.pay, value: pay ?? copy.card.payNotSet },
  ] as Array<FactRow | null>).filter((fact): fact is FactRow => Boolean(fact));

  const posted = formatVacancyDate(vacancy.publishedAt, locale);
  const until = state === "open" ? formatVacancyDate(vacancy.expiresAt, locale) : null;

  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");
  const pageUrl = `${siteUrl}/${vacancy.locale}${buildVacancyPath(vacancy.slug)}`;
  const companyUrl = `${siteUrl}/${locale}${buildCompanyPath(vacancy.company.slug)}`;
  const indexable = isVacancyIndexable(vacancy) && vacancy.locale === locale;
  const websiteLabel = formatCompanyWebsiteLabel(company?.website);

  // The author, an owner or an admin of the company deletes (as RLS does).
  const canDelete =
    viewer.isAdmin ||
    canEditCompany(role) ||
    (isTeam && vacancy.authorUserId === viewer.user?.id);

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      {indexable && vacancy.publishedAt && vacancy.expiresAt ? (
        <>
          <JsonLd
            data={buildJobPostingSchema({
              title: vacancy.title,
              descriptionHtml: vacancy.description,
              pageUrl,
              datePosted: vacancy.publishedAt,
              validThrough: vacancy.expiresAt,
              employmentTypes: vacancyEmploymentTypes(vacancy.kind, vacancy.hours),
              company: {
                name: vacancy.company.name,
                pageUrl: companyUrl,
                website: company?.website ?? null,
                logoUrl: vacancy.company.logoUrl,
              },
              city: vacancy.city,
              countryName: vacancy.countryName,
              remoteOnly: vacancy.workFormats.length === 1 && vacancy.workFormats[0] === "remote",
              pay: vacancy.pay,
              inLanguage: toBcp47(vacancy.locale),
              skills: vacancy.skills.map((skill) => skill.name),
            })}
          />
          <JsonLd
            data={buildBreadcrumbSchema([
              { name: dictionary.site.name, url: `${siteUrl}/${locale}` },
              { name: copy.list.title, url: `${siteUrl}/${locale}${JOBS_PATH}` },
              { name: vacancy.title, url: pageUrl },
            ])}
          />
        </>
      ) : null}
      {state !== "draft" ? <ViewBeacon targetType="vacancy" targetId={vacancy.id} /> : null}

      {notice ? (
        <div
          role="status"
          className="mb-4 rounded-none border app-border bg-[color:var(--surface-muted)] p-4 text-sm leading-6 text-[color:var(--foreground)] sm:mb-6 sm:rounded-2xl"
        >
          {notice}
        </div>
      ) : null}

      {closedNotice ? (
        <div
          role="status"
          className="mb-4 flex flex-col gap-3 rounded-none border app-border bg-[color:var(--surface-muted)] p-4 text-sm leading-6 text-[color:var(--foreground)] sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl"
        >
          <p>{closedNotice}</p>
          <ButtonLink href={JOBS_PATH} size="sm" variant="secondary">
            {copy.page.allJobs}
          </ButtonLink>
        </div>
      ) : null}

      <div className="grid gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <div className="min-w-0 space-y-6 sm:space-y-8">
          <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8 md:p-10">
            <LocalizedLink
              href={buildCompanyPath(vacancy.company.slug)}
              className="inline-flex max-w-full items-center gap-3 transition-colors hover:text-[color:var(--brand)]"
            >
              <CompanyLogo
                name={vacancy.company.name}
                logoUrl={vacancy.company.logoUrl}
                alt={dictionary.companies.logoAlt.replace("{name}", vacancy.company.name)}
                size="sm"
                priority
              />
              <span className="truncate text-sm font-medium text-[color:var(--foreground)]">
                {vacancy.company.name}
              </span>
            </LocalizedLink>

            <h1 className="font-display mt-5 break-words text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              {vacancy.title}
            </h1>

            <p className="mt-3 text-sm app-muted">
              {[posted ? copy.page.posted.replace("{date}", posted) : null, until ? copy.page.until.replace("{date}", until) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {isTeam || viewer.isAdmin ? (
              <div className="mt-5">
                <VacancyStatusActions
                  vacancyId={vacancy.id}
                  title={vacancy.title}
                  status={vacancy.status}
                  expiresAt={vacancy.expiresAt}
                  canDelete={canDelete}
                />
              </div>
            ) : null}

            <dl className="mt-8 grid gap-5 border-t app-border pt-6 sm:grid-cols-2 lg:grid-cols-3">
              {facts.map((fact) => (
                <Fact key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </dl>
          </section>

          {vacancy.description ? (
            <section
              className="rounded-none app-card p-5 sm:rounded-hero sm:p-8 md:p-10"
              aria-labelledby="vacancy-about"
              lang={vacancy.locale}
            >
              <h2
                id="vacancy-about"
                className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]"
              >
                {copy.page.description}
              </h2>
              <div className="mt-5 max-w-3xl">
                <RichTextRenderer content={vacancy.description} accentColor="var(--brand)" />
              </div>
            </section>
          ) : null}

          {vacancy.skills.length > 0 ? (
            <section
              className="rounded-none app-card p-5 sm:rounded-hero sm:p-8"
              aria-labelledby="vacancy-skills"
            >
              <h2
                id="vacancy-skills"
                className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]"
              >
                {copy.page.skills}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {vacancy.skills.map((skill) => (
                  <li
                    key={skill.id}
                    className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
                  >
                    {skill.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-6" aria-labelledby="vacancy-company">
            <h2 id="vacancy-company" className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {copy.page.aboutCompany}
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <CompanyLogo
                name={vacancy.company.name}
                logoUrl={vacancy.company.logoUrl}
                alt=""
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-[color:var(--foreground)]">
                  {vacancy.company.name}
                </p>
                {vacancy.company.verified ? (
                  <div className="mt-1">
                    <CompanyVerifiedBadge
                      label={dictionary.companies.verified}
                      hint={dictionary.companies.verifiedHint}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {company?.description ? (
              <p className="mt-4 line-clamp-5 whitespace-pre-line text-sm leading-7 app-muted">
                {company.description}
              </p>
            ) : null}
            {!vacancy.company.verified ? (
              <p className="mt-4 text-xs leading-5 app-soft">{copy.page.unverifiedCompany}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href={buildCompanyPath(vacancy.company.slug)} variant="secondary" size="sm">
                {copy.page.openCompany}
              </ButtonLink>
              {company?.website && websiteLabel ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  className="inline-flex items-center px-3 text-sm font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
                >
                  {websiteLabel} ↗
                </a>
              ) : null}
            </div>
          </section>

          {!isTeam && state !== "draft" ? (
            <div className="flex justify-end px-5 sm:px-0">
              <ContentReportButton
                copy={getModerationCopy(locale)}
                targetType="vacancy"
                targetId={vacancy.id}
                isAuthenticated={Boolean(viewer.user)}
              />
            </div>
          ) : null}
        </aside>
      </div>

      {otherVacancies.length > 0 ? (
        <section className="mt-8 sm:mt-10" aria-labelledby="vacancy-more">
          <h2
            id="vacancy-more"
            className="font-display px-5 text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:px-0"
          >
            {copy.page.more.replace("{company}", vacancy.company.name)}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {otherVacancies.map((item) => (
              <VacancyCard
                key={item.id}
                vacancy={item}
                dictionary={dictionary}
                locale={locale}
                showCompany={false}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
