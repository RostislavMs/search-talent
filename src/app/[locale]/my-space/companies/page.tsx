import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CompanyInvitations from "@/components/company-invitations";
import CompanyLogo from "@/components/company-logo";
import CompanyVerifiedBadge from "@/components/company-verified-badge";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { buildLoginHref } from "@/lib/auth/redirect";
import { buildCompanyPath, canEditCompany, type MyCompany } from "@/lib/companies";
import { listMyCompanies, listPendingCompanyInvitations } from "@/lib/db/companies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

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
  const copy = getDictionary(locale).companies.meta;

  return buildMetadata({
    locale,
    pathname: "/my-space/companies",
    title: copy.mineTitle,
    description: copy.mineDescription,
    noindex: true,
  });
}

function StatusLine({ company, copy }: { company: MyCompany; copy: Dictionary["companies"] }) {
  if (company.moderationStatus === "under_review") {
    return <span className="text-xs font-medium text-amber-600">{copy.mine.underReview}</span>;
  }

  if (company.moderationStatus !== "approved") {
    return <span className="text-xs font-medium text-rose-600">{copy.mine.hidden}</span>;
  }

  if (company.verified) {
    return <CompanyVerifiedBadge label={copy.verified} hint={copy.verifiedHint} />;
  }

  return <span className="text-xs app-soft">{copy.mine.notVerified}</span>;
}

export default async function MyCompaniesPage({
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
    redirect(buildLoginHref(locale, "/my-space/companies"));
  }

  const copy = getDictionary(locale).companies;
  const [companies, invitations] = await Promise.all([
    listMyCompanies(supabase, user.id),
    listPendingCompanyInvitations(supabase, user.id),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {copy.mine.title}
          </h1>
          <p className="mt-1 text-sm app-muted">{copy.mine.description}</p>
        </div>
        {companies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/my-space/vacancies" variant="secondary">
              {copy.mine.vacancies}
            </ButtonLink>
            <ButtonLink href="/companies/new">{copy.mine.create}</ButtonLink>
          </div>
        ) : null}
      </div>

      <CompanyInvitations initialInvitations={invitations} />

      {companies.length > 0 ? (
        <ul className="space-y-3">
          {companies.map((company) => (
            <li
              key={company.id}
              className="flex flex-col gap-4 rounded-hero app-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <CompanyLogo
                  name={company.name}
                  logoUrl={company.logoUrl}
                  alt={copy.logoAlt.replace("{name}", company.name)}
                />
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-display text-lg font-semibold text-[color:var(--foreground)]">
                    <LocalizedLink
                      href={buildCompanyPath(company.slug)}
                      className="transition-colors hover:text-[color:var(--brand)]"
                    >
                      {company.name}
                    </LocalizedLink>
                  </p>
                  <p className="text-sm app-muted">
                    {copy.roles[company.role]} ·{" "}
                    {copy.mine.members.replace("{count}", String(company.membersCount))}
                  </p>
                  <StatusLine company={company} copy={copy} />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <ButtonLink href={buildCompanyPath(company.slug)} variant="secondary" size="sm">
                  {copy.mine.open}
                </ButtonLink>
                <ButtonLink href={`/companies/edit/${company.id}`} size="sm">
                  {canEditCompany(company.role) ? copy.mine.manage : copy.page.team}
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="rounded-hero app-card p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.mine.emptyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.mine.emptyText}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/companies/new">{copy.mine.create}</ButtonLink>
            <ButtonLink href="/for-companies" variant="secondary">
              {copy.mine.learnMore}
            </ButtonLink>
          </div>
        </section>
      )}
    </main>
  );
}
