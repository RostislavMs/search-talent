import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import ApplicationStatusPill from "@/components/application-status-pill";
import ApplicationTeamActions from "@/components/application-team-actions";
import ApplicationsViewedBeacon from "@/components/applications-viewed-beacon";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import {
  APPLICATION_TEAM_FILTERS,
  applicationMatchesTeamFilter,
  buildTeamApplicationsPath,
  countApplicationsByFilter,
  parseApplicationTeamFilter,
  type ApplicationTeamFilter,
  type TeamApplication,
} from "@/lib/applications";
import { buildLoginHref } from "@/lib/auth/redirect";
import { listTeamApplications } from "@/lib/db/applications";
import { getCompanyRole } from "@/lib/db/companies";
import { getVacancyById } from "@/lib/db/vacancies";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { formatOpenToList } from "@/lib/open-to";
import { buildProjectPath } from "@/lib/projects";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { buildVacancyPath } from "@/lib/vacancies";
import { formatVacancyDate } from "@/lib/vacancy-presentation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = Promise<{ locale: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveParams(params: RouteParams): Promise<{ locale: Locale; id: string }> {
  const { locale, id } = await params;
  if (!isLocale(locale) || !UUID_PATTERN.test(id)) notFound();
  return { locale, id };
}

// One read per request, shared by the metadata and the page. RLS shows the
// team any of its vacancies.
const loadVacancy = cache(async (id: string) => {
  const supabase = await createClient();
  return getVacancyById(supabase, id);
});

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, id } = await resolveParams(params);
  const dictionary = getDictionary(locale);
  const copy = dictionary.applications.meta;
  const vacancy = await loadVacancy(id);

  return buildMetadata({
    locale,
    pathname: buildTeamApplicationsPath(id),
    title: vacancy ? copy.teamTitle.replace("{title}", vacancy.title) : dictionary.applications.team.eyebrow,
    description: copy.teamDescription,
    noindex: true,
  });
}

function ApplicantHeader({
  application,
  dictionary,
}: {
  application: TeamApplication;
  dictionary: Dictionary;
}) {
  const copy = dictionary.applications.team;
  const applicant = application.applicant;
  const name = applicant ? applicant.name || `@${applicant.username}` : copy.candidate;
  const openTo = applicant ? formatOpenToList(applicant.openTo, dictionary.openTo.phrases) : "";

  const avatar = (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-muted)] text-base font-semibold text-[color:var(--foreground)]">
      {applicant?.avatarUrl ? (
        <OptimizedImage src={applicant.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span aria-hidden="true">{name.replace("@", "").slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );

  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <div className="min-w-0">
        {applicant ? (
          <LocalizedLink
            href={`/u/${applicant.username}`}
            className="block truncate font-display text-lg font-semibold text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
          >
            {name}
          </LocalizedLink>
        ) : (
          <p className="truncate font-display text-lg font-semibold text-[color:var(--foreground)]">{name}</p>
        )}
        {applicant?.headline ? (
          <p className="truncate text-sm app-muted">{applicant.headline}</p>
        ) : !applicant ? (
          <p className="text-sm app-muted">{copy.profileHidden}</p>
        ) : null}
        {openTo ? (
          <p className="mt-0.5 text-xs app-soft">{dictionary.openTo.badge.replace("{list}", openTo)}</p>
        ) : null}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  dictionary,
  locale,
  vacancyHidden,
}: {
  application: TeamApplication;
  dictionary: Dictionary;
  locale: Locale;
  vacancyHidden: boolean;
}) {
  const copy = dictionary.applications.team;
  const applied = formatVacancyDate(application.createdAt, locale);
  const withdrawn = application.status === "withdrawn";

  return (
    <li id={`application-${application.id}`} className="scroll-mt-24 rounded-hero app-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <ApplicantHeader application={application} dictionary={dictionary} />
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {application.status === "new" ? (
            <span className="rounded-full bg-[color:var(--brand)] px-2.5 py-0.5 text-xs font-semibold text-white">
              {copy.fresh}
            </span>
          ) : (
            <ApplicationStatusPill status={application.status} labels={dictionary.applications.teamStatuses} />
          )}
          {applied ? (
            <span className="text-xs app-soft">{copy.applied.replace("{date}", applied)}</span>
          ) : null}
        </div>
      </div>

      {withdrawn ? (
        <p className="mt-4 text-sm app-muted">
          {copy.withdrawnNote.replace("{date}", formatVacancyDate(application.withdrawnAt, locale) ?? "")}
        </p>
      ) : (
        <>
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.message}</h3>
            <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm leading-7 text-[color:var(--foreground)]">
              {application.message || <span className="app-muted">{copy.noMessage}</span>}
            </p>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.projects}</h3>
            {application.projects.length > 0 ? (
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {application.projects.map((project) => (
                  <li key={project.id}>
                    <LocalizedLink
                      href={buildProjectPath(project.id, project.slug)}
                      className="group block overflow-hidden rounded-2xl border app-border transition-colors hover:border-[color:var(--foreground)]"
                    >
                      <span className="relative block aspect-[16/10] bg-[color:var(--surface-muted)]">
                        {project.coverUrl ? (
                          <OptimizedImage
                            src={project.coverUrl}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate px-3 py-2.5 text-sm font-medium text-[color:var(--foreground)]">
                        {project.title}
                      </span>
                    </LocalizedLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm app-muted">{copy.noProjects}</p>
            )}
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.contacts}</h3>
            {application.contacts ? (
              <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {application.contacts.email ? (
                  <div>
                    <dt className="text-xs app-muted">{copy.email}</dt>
                    <dd>
                      <a
                        href={`mailto:${application.contacts.email}`}
                        className="break-all font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 transition hover:decoration-[color:var(--foreground)]"
                      >
                        {application.contacts.email}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {application.contacts.phone ? (
                  <div>
                    <dt className="text-xs app-muted">{copy.phone}</dt>
                    <dd>
                      <a
                        href={`tel:${application.contacts.phone}`}
                        className="font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 transition hover:decoration-[color:var(--foreground)]"
                      >
                        {application.contacts.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-2 text-sm app-muted">{vacancyHidden ? copy.hiddenVacancy : "—"}</p>
            )}
          </div>

          <div className="mt-6 border-t app-border pt-5">
            <ApplicationTeamActions applicationId={application.id} status={application.status} />
          </div>
        </>
      )}
    </li>
  );
}

export default async function VacancyApplicationsPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { locale, id } = await resolveParams(params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginHref(locale, buildTeamApplicationsPath(id)));
  }

  const vacancy = await loadVacancy(id);
  const role = vacancy ? await getCompanyRole(supabase, vacancy.company.id, user.id) : null;

  // Only the company's team; anyone else gets the same "not found" as for a
  // vacancy that does not exist.
  if (!vacancy || !role) {
    notFound();
  }

  const dictionary = getDictionary(locale);
  const copy = dictionary.applications.team;
  const filter = parseApplicationTeamFilter((await searchParams).status);
  const applications = await listTeamApplications(supabase, vacancy.id);
  const counts = countApplicationsByFilter(applications.map((application) => application.status));
  const shown = applications.filter((application) => applicationMatchesTeamFilter(application.status, filter));
  const unseenIds = shown.filter((application) => application.status === "new").map((application) => application.id);
  const vacancyHidden =
    vacancy.moderationStatus !== "approved" || vacancy.company.moderationStatus !== "approved";

  const tabs = APPLICATION_TEAM_FILTERS.filter(
    (tab) => tab === "all" || tab === filter || counts[tab] > 0,
  );
  const tabHref = (tab: ApplicationTeamFilter) =>
    tab === "all" ? buildTeamApplicationsPath(vacancy.id) : `${buildTeamApplicationsPath(vacancy.id)}?status=${tab}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {unseenIds.length > 0 ? <ApplicationsViewedBeacon ids={unseenIds} /> : null}

      <LocalizedLink
        href="/my-space/vacancies"
        className="text-sm app-muted transition-colors hover:text-[color:var(--foreground)]"
      >
        ← {copy.back}
      </LocalizedLink>

      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.eyebrow}</p>
          <h1 className="mt-1 break-words font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {vacancy.title}
          </h1>
          <p className="mt-1 text-sm app-muted">
            {vacancy.company.name} · {dictionary.vacancies.states[vacancy.state]}
          </p>
        </div>
        <ButtonLink href={buildVacancyPath(vacancy.slug)} variant="secondary">
          {copy.openVacancy}
        </ButtonLink>
      </div>

      {vacancyHidden ? (
        <div
          role="status"
          className="mb-6 rounded-2xl border app-border bg-[color:var(--surface-muted)] p-4 text-sm leading-6 text-[color:var(--foreground)]"
        >
          {copy.hiddenVacancy}
        </div>
      ) : null}

      {applications.length === 0 ? (
        <section className="rounded-hero app-card p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {copy.empty}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.emptyHint}</p>
        </section>
      ) : (
        <>
          <nav aria-label={copy.filtersLabel} className="mb-5 flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = tab === filter;
              return (
                <LocalizedLink
                  key={tab}
                  href={tabHref(tab)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                      : "app-border text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
                  }`}
                >
                  {copy.filters[tab]} <span className="opacity-70">{counts[tab]}</span>
                </LocalizedLink>
              );
            })}
          </nav>

          <p className="mb-5 text-sm app-muted">{copy.replyHint}</p>

          {shown.length === 0 ? (
            <p className="rounded-hero app-card p-6 text-sm app-muted">{copy.emptyFiltered}</p>
          ) : (
            <ul className="space-y-4">
              {shown.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  dictionary={dictionary}
                  locale={locale}
                  vacancyHidden={vacancyHidden}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
