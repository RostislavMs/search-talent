import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ApplicationStatusPill from "@/components/application-status-pill";
import ApplicationWithdrawButton from "@/components/application-withdraw-button";
import CompanyLogo from "@/components/company-logo";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { MY_APPLICATIONS_PATH, type MyApplication } from "@/lib/applications";
import { buildLoginHref } from "@/lib/auth/redirect";
import { buildCompanyPath } from "@/lib/companies";
import { listMyApplications } from "@/lib/db/applications";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { buildProjectPath } from "@/lib/projects";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { JOBS_PATH, buildVacancyPath } from "@/lib/vacancies";
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
  const copy = getDictionary(locale).applications.meta;

  return buildMetadata({
    locale,
    pathname: MY_APPLICATIONS_PATH,
    title: copy.mineTitle,
    description: copy.mineDescription,
    noindex: true,
  });
}

function ApplicationItem({
  application,
  dictionary,
  locale,
}: {
  application: MyApplication;
  dictionary: Dictionary;
  locale: Locale;
}) {
  const copy = dictionary.applications;
  const vacancy = application.vacancy;
  const applied = formatVacancyDate(application.createdAt, locale);
  const vacancyNote =
    !vacancy
      ? copy.mine.vacancyGone
      : vacancy.state === "closed" || vacancy.state === "expired"
        ? copy.mine.vacancyStates[vacancy.state]
        : null;

  return (
    <li className="rounded-hero app-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {vacancy ? (
            <CompanyLogo
              name={vacancy.company.name}
              logoUrl={vacancy.company.logoUrl}
              alt=""
              size="sm"
            />
          ) : null}
          <div className="min-w-0">
            {vacancy ? (
              <>
                <LocalizedLink
                  href={buildVacancyPath(vacancy.slug)}
                  className="block break-words font-display text-lg font-semibold text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
                >
                  {vacancy.title}
                </LocalizedLink>
                <LocalizedLink
                  href={buildCompanyPath(vacancy.company.slug)}
                  className="text-sm app-muted transition-colors hover:text-[color:var(--foreground)]"
                >
                  {vacancy.company.name}
                </LocalizedLink>
              </>
            ) : null}
            <p className="mt-1 text-xs app-soft">
              {[applied ? copy.mine.applied.replace("{date}", applied) : null, vacancyNote]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ApplicationStatusPill status={application.status} labels={copy.candidateStatuses} />
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[color:var(--foreground)]">
        {copy.candidateStatusHints[application.status]}
      </p>

      {application.projects.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.mine.projects}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {application.projects.map((project) => (
              <li key={project.id}>
                <LocalizedLink
                  href={buildProjectPath(project.id, project.slug)}
                  className="inline-flex max-w-full rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition-colors hover:border-[color:var(--foreground)]"
                >
                  <span className="truncate">{project.title}</span>
                </LocalizedLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {application.status !== "withdrawn" ? (
        <div className="mt-4 flex justify-end">
          <ApplicationWithdrawButton
            applicationId={application.id}
            vacancyTitle={vacancy?.title ?? ""}
          />
        </div>
      ) : null}
    </li>
  );
}

export default async function MyApplicationsPage({
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
    redirect(buildLoginHref(locale, MY_APPLICATIONS_PATH));
  }

  const dictionary = getDictionary(locale);
  const copy = dictionary.applications.mine;
  const applications = await listMyApplications(supabase, user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm app-muted">{copy.description}</p>
        </div>
        {applications.length > 0 ? (
          <ButtonLink href={JOBS_PATH} variant="secondary">
            {copy.browse}
          </ButtonLink>
        ) : null}
      </div>

      {applications.length === 0 ? (
        <section className="rounded-hero app-card p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.emptyTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.emptyText}</p>
          <div className="mt-5">
            <ButtonLink href={JOBS_PATH}>{copy.browse}</ButtonLink>
          </div>
        </section>
      ) : (
        <ul className="space-y-4">
          {applications.map((application) => (
            <ApplicationItem
              key={application.id}
              application={application}
              dictionary={dictionary}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
