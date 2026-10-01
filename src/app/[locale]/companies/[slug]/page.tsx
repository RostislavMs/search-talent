import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import CompanyLogo from "@/components/company-logo";
import CompanyVerifiedBadge from "@/components/company-verified-badge";
import ContentReportButton from "@/components/content-report-button";
import JsonLd from "@/components/json-ld";
import ProjectCard from "@/components/project-card";
import VacancyCard from "@/components/vacancy-card";
import ViewBeacon from "@/components/view-beacon";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import {
  buildCompanyPath,
  formatCompanyLocation,
  formatCompanyWebsiteLabel,
  isCompanyIndexable,
  type CompanyMember,
} from "@/lib/companies";
import {
  getCompanyBySlug,
  getCompanyRole,
  listCompanyProjects,
  listCompanyTeam,
} from "@/lib/db/companies";
import { listCompanyOpenVacancies } from "@/lib/db/vacancies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getModerationCopy } from "@/lib/moderation-copy";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  buildBreadcrumbSchema,
  buildCompanySchema,
  buildMetadata,
  composeSeoTitle,
  getMetadataBase,
} from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

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
const loadCompany = cache(async (slug: string) => {
  const supabase = await createClient();
  return getCompanyBySlug(supabase, slug);
});

function metaDescription(dictionary: Dictionary, name: string, description: string | null) {
  const text = description?.replace(/\s+/g, " ").trim();
  if (text && text.length >= 50) {
    return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
  }
  return dictionary.companies.page.metaDescription.replace("{name}", name);
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, slug } = await resolveParams(params);
  const dictionary = getDictionary(locale);
  const company = await loadCompany(slug);

  if (!company) {
    return buildMetadata({
      locale,
      pathname: buildCompanyPath(slug),
      title: dictionary.companies.page.eyebrowCompany,
      description: dictionary.companies.meta.newDescription,
      noindex: true,
    });
  }

  return buildMetadata({
    locale,
    pathname: buildCompanyPath(company.slug),
    title: composeSeoTitle(locale, company.name),
    absoluteTitle: true,
    description: metaDescription(dictionary, company.name, company.description),
    ogType: "profile",
    // An unverified page is anyone's claim about a company.
    noindex: !isCompanyIndexable(company),
  });
}

function TeamCard({ member, dictionary }: { member: CompanyMember; dictionary: Dictionary }) {
  const name = member.name || (member.username ? `@${member.username}` : dictionary.common.creator);

  return (
    <LocalizedLink
      href={`/u/${member.username}`}
      className="flex items-center gap-3 rounded-2xl app-panel p-4 transition-colors hover:border-[color:var(--foreground)]"
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-muted)] text-base font-semibold text-[color:var(--foreground)]">
        {member.avatarUrl ? (
          <OptimizedImage src={member.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span aria-hidden="true">{name.replace("@", "").slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[color:var(--foreground)]">
          {name}
        </span>
        {member.headline ? (
          <span className="block truncate text-xs app-muted">{member.headline}</span>
        ) : null}
      </span>
    </LocalizedLink>
  );
}

export default async function CompanyPage({ params }: { params: RouteParams }) {
  const { locale, slug } = await resolveParams(params);
  const company = await loadCompany(slug);

  if (!company) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const copy = dictionary.companies;
  const viewer = await getCurrentViewerRole();
  const role = await getCompanyRole(viewer.supabase, company.id, viewer.user?.id);
  const isMember = Boolean(role);

  const [allTeam, linked, vacancies] = await Promise.all([
    listCompanyTeam(viewer.supabase, company.id),
    listCompanyProjects(viewer.supabase, company.id, 24),
    listCompanyOpenVacancies(viewer.supabase, company.id),
  ]);
  const team = allTeam.filter((member) => member.username);
  // Requests from outside authors wait in the editor; the page shows accepted work.
  const projects = linked.filter((project) => project.status === "approved");

  const isSchool = company.type === "school";
  const websiteLabel = formatCompanyWebsiteLabel(company.website);
  const location = formatCompanyLocation(company.city, company.countryName);
  type Fact = { label: string; value: string; href?: string };
  const facts: Fact[] = [];
  if (websiteLabel && company.website) {
    facts.push({ label: copy.page.website, value: websiteLabel, href: company.website });
  }
  if (company.size) {
    facts.push({ label: copy.page.size, value: copy.sizes[company.size] });
  }
  if (location) {
    facts.push({ label: copy.page.location, value: location });
  }

  const notice =
    isMember || viewer.isAdmin
      ? company.moderationStatus === "under_review"
        ? copy.page.underReview
        : company.moderationStatus !== "approved"
          ? copy.page.hidden
          : !company.verified && isMember
            ? copy.page.unverified
            : null
      : null;

  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");
  const pageUrl = `${siteUrl}/${locale}${buildCompanyPath(company.slug)}`;
  const indexable = isCompanyIndexable(company);

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      {indexable ? (
        <>
          <JsonLd
            data={buildCompanySchema({
              type: company.type,
              name: company.name,
              pageUrl,
              website: company.website,
              logoUrl: company.logoUrl,
              description: company.description,
              city: company.city,
              countryName: company.countryName,
            })}
          />
          <JsonLd
            data={buildBreadcrumbSchema([
              { name: dictionary.site.name, url: `${siteUrl}/${locale}` },
              { name: company.name, url: pageUrl },
            ])}
          />
        </>
      ) : null}
      {company.moderationStatus === "approved" ? (
        <ViewBeacon targetType="company" targetId={company.id} />
      ) : null}

      {notice ? (
        <div
          role="status"
          className="mb-4 flex flex-col gap-3 rounded-none border app-border bg-[color:var(--surface-muted)] p-4 text-sm leading-6 text-[color:var(--foreground)] sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl"
        >
          <p>{notice}</p>
          {notice === copy.page.unverified && role !== "recruiter" ? (
            <ButtonLink href={`/companies/edit/${company.id}`} size="sm" variant="secondary">
              {copy.page.verifyCta}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8 md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <CompanyLogo
              name={company.name}
              logoUrl={company.logoUrl}
              alt={copy.logoAlt.replace("{name}", company.name)}
              size="lg"
              priority
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
                {isSchool ? copy.page.eyebrowSchool : copy.page.eyebrowCompany}
              </p>
              <h1 className="font-display mt-2 break-words text-3xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-4xl">
                {company.name}
              </h1>
              {company.verified ? (
                <div className="mt-3">
                  <CompanyVerifiedBadge label={copy.verified} hint={copy.verifiedHint} />
                </div>
              ) : null}
            </div>
          </div>

          {isMember || viewer.isAdmin ? (
            <div className="flex flex-wrap gap-2 self-start">
              {company.moderationStatus === "approved" ? (
                <ButtonLink href={`/jobs/new?company=${company.id}`} variant="secondary">
                  {dictionary.vacancies.companySection.post}
                </ButtonLink>
              ) : null}
              <ButtonLink href={`/companies/edit/${company.id}`} variant="secondary">
                {copy.page.manage}
              </ButtonLink>
            </div>
          ) : null}
        </div>

        {facts.length > 0 ? (
          <dl className="mt-8 grid gap-4 border-t app-border pt-6 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                  {fact.label}
                </dt>
                <dd className="mt-1 truncate text-sm text-[color:var(--foreground)]">
                  {fact.href ? (
                    <a
                      href={fact.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      className="font-medium text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
                    >
                      {fact.value} ↗
                    </a>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      {vacancies.length > 0 ? (
        <section className="mt-6 sm:mt-8" aria-labelledby="company-vacancies">
          <h2
            id="company-vacancies"
            className="font-display px-5 text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:px-0"
          >
            {dictionary.vacancies.companySection.title}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vacancies.map((vacancy) => (
              <VacancyCard
                key={vacancy.id}
                vacancy={vacancy}
                dictionary={dictionary}
                locale={locale}
                showCompany={false}
              />
            ))}
          </div>
        </section>
      ) : null}

      {company.description ? (
        <section
          className="mt-6 rounded-none app-card p-5 sm:mt-8 sm:rounded-hero sm:p-8"
          aria-labelledby="company-about"
        >
          <h2
            id="company-about"
            className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]"
          >
            {isSchool ? copy.page.aboutSchool : copy.page.aboutCompany}
          </h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-8 app-muted">
            {company.description}
          </p>
        </section>
      ) : null}

      {team.length > 0 ? (
        <section
          className="mt-6 rounded-none app-card p-5 sm:mt-8 sm:rounded-hero sm:p-8"
          aria-labelledby="company-team"
        >
          <h2
            id="company-team"
            className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]"
          >
            {copy.page.team}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {team.map((member) => (
              <TeamCard key={member.memberId} member={member} dictionary={dictionary} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Only projects the authors attached to the company, never everything the
          team ever published. With none yet, visitors see no empty block; the
          team sees where to add them. */}
      {projects.length > 0 || isMember ? (
        <section className="mt-6 sm:mt-8" aria-labelledby="company-work">
          <h2
            id="company-work"
            className="font-display px-5 text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:px-0"
          >
            {copy.page.work}
          </h2>
          {projects.length > 0 ? (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} dictionary={dictionary} project={project} />
              ))}
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3 rounded-none app-card p-6 sm:flex-row sm:items-center sm:justify-between sm:rounded-panel">
              <p className="text-sm app-muted">{copy.page.workEmpty}</p>
              <ButtonLink href={`/companies/edit/${company.id}`} variant="secondary" size="sm">
                {copy.page.addProjects}
              </ButtonLink>
            </div>
          )}
        </section>
      ) : null}

      {!isMember ? (
        <div className="mt-6 flex justify-end px-5 sm:mt-8 sm:px-0">
          <ContentReportButton
            copy={getModerationCopy(locale)}
            targetType="company"
            targetId={company.id}
            isAuthenticated={Boolean(viewer.user)}
          />
        </div>
      ) : null}
    </main>
  );
}
