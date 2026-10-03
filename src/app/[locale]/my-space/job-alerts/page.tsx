import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CompanyLogo from "@/components/company-logo";
import { JobAlertControls, JobAlertProfileSwitch } from "@/components/job-alert-controls";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { buildLoginHref } from "@/lib/auth/redirect";
import { listJobAlertMatches, listMyJobAlerts, type JobAlert } from "@/lib/db/job-alerts";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { JOB_ALERTS_PATH, JOB_ALERT_LIMITS, vacancyKindsFromOpenTo } from "@/lib/job-alerts";
import { formatOpenToList, normalizeOpenTo } from "@/lib/open-to";
import { buildMetadata } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { JOBS_PATH, buildVacancyPath, type VacancySummary } from "@/lib/vacancies";

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
  const copy = getDictionary(locale).jobAlerts.meta;

  return buildMetadata({
    locale,
    pathname: JOB_ALERTS_PATH,
    title: copy.title,
    description: copy.description,
    noindex: true,
  });
}

function LatestMatches({
  vacancies,
  dictionary,
}: {
  vacancies: VacancySummary[];
  dictionary: Dictionary;
}) {
  const copy = dictionary.jobAlerts.page;

  if (vacancies.length === 0) {
    return <p className="mt-4 text-sm app-muted">{copy.nothingYet}</p>;
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.latest}</p>
      <ul className="mt-2 divide-y divide-[color:var(--border)]">
        {vacancies.map((vacancy) => (
          <li key={vacancy.id} className="flex items-center gap-3 py-2.5">
            <CompanyLogo name={vacancy.company.name} logoUrl={vacancy.company.logoUrl} alt="" size="sm" />
            <div className="min-w-0">
              <LocalizedLink
                href={buildVacancyPath(vacancy.slug)}
                className="block truncate text-sm font-medium text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
              >
                {vacancy.title}
              </LocalizedLink>
              <p className="truncate text-xs app-muted">
                {[
                  vacancy.company.name,
                  vacancy.state === "open" ? null : dictionary.vacancies.states[vacancy.state],
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchItem({
  alert,
  matches,
  dictionary,
}: {
  alert: JobAlert;
  matches: VacancySummary[];
  dictionary: Dictionary;
}) {
  const copy = dictionary.jobAlerts.page;

  return (
    <li className="rounded-hero app-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <LocalizedLink
            href={alert.href}
            className="block break-words font-display text-lg font-semibold text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
          >
            {alert.name}
          </LocalizedLink>
          <LocalizedLink
            href={alert.href}
            className="text-sm app-muted transition-colors hover:text-[color:var(--foreground)]"
          >
            {copy.open}
          </LocalizedLink>
        </div>
        <JobAlertControls alertId={alert.id} name={alert.name} notifyEmail={alert.notifyEmail} />
      </div>
      <LatestMatches vacancies={matches} dictionary={dictionary} />
    </li>
  );
}

export default async function JobAlertsPage({
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
    redirect(buildLoginHref(locale, JOB_ALERTS_PATH));
  }

  const dictionary = getDictionary(locale);
  const copy = dictionary.jobAlerts.page;

  const [alerts, { data: profile }] = await Promise.all([
    listMyJobAlerts(supabase, user.id),
    supabase.from("profiles").select("open_to").eq("user_id", user.id).maybeSingle(),
  ]);
  const matches = await listJobAlertMatches(
    supabase,
    alerts.map((alert) => alert.id),
  );

  const profileAlert = alerts.find((alert) => alert.target.type === "profile") ?? null;
  const searches = alerts.filter((alert) => alert.target.type === "filters");
  const openTo = normalizeOpenTo((profile as { open_to?: unknown } | null)?.open_to);
  const canMatchProfile = vacancyKindsFromOpenTo(openTo).length > 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-[color:var(--foreground)]">
            {copy.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm app-muted">{copy.description}</p>
        </div>
        <ButtonLink href={JOBS_PATH} variant="secondary">
          {copy.browse}
        </ButtonLink>
      </div>

      {!user.email_confirmed_at ? (
        <p className="mb-6 rounded-2xl app-panel p-4 text-sm leading-6 text-[color:var(--foreground)]">
          {copy.confirmEmail}
        </p>
      ) : null}

      <section className="rounded-hero app-card p-5 sm:p-6" aria-label={copy.profileTitle}>
        <JobAlertProfileSwitch
          alertId={profileAlert?.id ?? null}
          notifyEmail={profileAlert?.notifyEmail ?? true}
          title={copy.profileTitle}
          hint={
            canMatchProfile
              ? copy.profileText.replace("{list}", formatOpenToList(vacancyKindsFromOpenTo(openTo), dictionary.openTo.phrases))
              : copy.profileNeedsOpenTo
          }
          disabled={!canMatchProfile && !profileAlert}
          showEmail
        />
        {!canMatchProfile ? (
          <div className="mt-4">
            <ButtonLink href="/my-space" variant="secondary" size="sm">
              {copy.profileNeedsOpenToCta}
            </ButtonLink>
          </div>
        ) : null}
        {profileAlert ? (
          <LatestMatches vacancies={matches.get(profileAlert.id) ?? []} dictionary={dictionary} />
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="job-alerts-searches">
        <h2
          id="job-alerts-searches"
          className="mb-3 text-sm font-semibold uppercase tracking-widest app-soft"
        >
          {copy.searchesTitle}
        </h2>

        {searches.length === 0 ? (
          <div className="rounded-hero app-card p-6 sm:p-8">
            <p className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {copy.emptyTitle}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-7 app-muted">{copy.emptyText}</p>
            <div className="mt-5">
              <ButtonLink href={JOBS_PATH}>{copy.browse}</ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {searches.map((alert) => (
                <SearchItem
                  key={alert.id}
                  alert={alert}
                  matches={matches.get(alert.id) ?? []}
                  dictionary={dictionary}
                />
              ))}
            </ul>
            <p className="mt-4 text-xs app-soft">
              {copy.limitNote.replace("{max}", String(JOB_ALERT_LIMITS.perPerson))}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
