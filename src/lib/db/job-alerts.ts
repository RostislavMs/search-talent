import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEmailRecipient } from "@/lib/db/email-recipients";
import { createNotifications } from "@/lib/db/notifications";
import {
  COMPANY_JOIN,
  NAME_JOINS,
  SUMMARY_COLUMNS,
  mapVacancySummary,
  type VacancySummaryRow,
} from "@/lib/db/vacancies";
import { sendEmailBatch, type SendEmailInput } from "@/lib/email/resend";
import {
  buildJobAlertDigestEmail,
  type JobAlertEmailItem,
  type JobAlertEmailSection,
} from "@/lib/email/templates";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildJobAlertOneClickUrl,
  buildJobAlertUnsubscribePageUrl,
} from "@/lib/job-alert-token";
import {
  JOB_ALERTS_PATH,
  JOB_ALERT_LIMITS,
  PROFILE_MATCH_PARAMS,
  describeJobAlertFilters,
  jobAlertHref,
  jobAlertWriteErrorCode,
  readJobAlertTarget,
  toJobAlertParams,
  vacancyLiveSince,
  vacancyMatchesFilters,
  vacancyMatchesProfile,
  type JobAlertFilters,
  type JobAlertTarget,
  type JobAlertWriteErrorCode,
  type MatchableVacancy,
  type ProfileForMatching,
} from "@/lib/job-alerts";
import { normalizeOpenTo } from "@/lib/open-to";
import { workFormats as WORK_FORMATS } from "@/lib/profile-sections";
import { getSiteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildVacancyPath,
  formatVacancyPay,
  formatVacancyPlace,
  type VacancySummary,
} from "@/lib/vacancies";

const DAY_MS = 24 * 60 * 60 * 1000;

type Joined<T> = T | T[] | null | undefined;

function firstJoined<T>(value: Joined<T>): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// --- The person's own alerts -------------------------------------------------------------

export type JobAlert = {
  id: string;
  target: JobAlertTarget;
  name: string;
  notifyEmail: boolean;
  createdAt: string;
  href: string;
};

type AlertRow = {
  id: string;
  user_id: string;
  name: string;
  params: unknown;
  notify_email: boolean | null;
  created_at: string;
};

const ALERT_COLUMNS = "id, user_id, name, params, notify_email, created_at";

function mapAlert(row: AlertRow): JobAlert {
  const target = readJobAlertTarget(row.params);
  return {
    id: row.id,
    target,
    name: row.name,
    notifyEmail: Boolean(row.notify_email),
    createdAt: row.created_at,
    href: jobAlertHref(target),
  };
}

/**
 * The person's job alerts, newest first. Empty until the migration adds the
 * email column: the query fails and the pages simply offer nothing to manage.
 */
export async function listMyJobAlerts(supabase: SupabaseClient, userId: string): Promise<JobAlert[]> {
  const { data, error } = await supabase
    .from("saved_searches")
    .select(ALERT_COLUMNS)
    .eq("user_id", userId)
    .eq("mode", "vacancies")
    .order("created_at", { ascending: false })
    .limit(JOB_ALERT_LIMITS.perPerson * 2);

  if (error || !data) {
    return [];
  }

  return (data as AlertRow[]).map(mapAlert);
}

/** The latest vacancies each alert sent, newest first; ones hidden since drop out. */
export async function listJobAlertMatches(
  supabase: SupabaseClient,
  alertIds: string[],
  { perAlert = 5, now = Date.now() }: { perAlert?: number; now?: number } = {},
): Promise<Map<string, VacancySummary[]>> {
  const matches = new Map<string, VacancySummary[]>();

  if (alertIds.length === 0) {
    return matches;
  }

  const { data, error } = await supabase
    .from("job_alert_deliveries")
    .select(`saved_search_id, delivered_at, vacancy:vacancy_id ( ${SUMMARY_COLUMNS}, ${COMPANY_JOIN}, ${NAME_JOINS} )`)
    .in("saved_search_id", alertIds)
    .order("delivered_at", { ascending: false })
    .limit(perAlert * alertIds.length * 3);

  if (error || !data) {
    return matches;
  }

  for (const row of data as unknown as Array<{
    saved_search_id: string;
    vacancy: Joined<VacancySummaryRow>;
  }>) {
    const vacancy = firstJoined(row.vacancy);
    if (!vacancy) continue;

    const list = matches.get(row.saved_search_id) ?? [];
    if (list.length < perAlert) {
      list.push(mapVacancySummary(vacancy, now));
      matches.set(row.saved_search_id, list);
    }
  }

  return matches;
}

/** Names of the place, field and skill the filters point to, for the alert's name. */
export async function getJobAlertFilterNames(
  supabase: SupabaseClient,
  filters: JobAlertFilters,
): Promise<{ country: string | null; category: string | null; skill: string | null }> {
  const nameOf = async (table: string, id: number | null) => {
    if (!id) return null;
    const { data } = await supabase.from(table).select("name").eq("id", id).maybeSingle();
    return (data as { name?: string | null } | null)?.name ?? null;
  };

  const [country, category, skill] = await Promise.all([
    nameOf("countries", filters.countryId),
    nameOf("profile_categories", filters.categoryId),
    nameOf("skills", filters.skillId),
  ]);

  return { country, category, skill };
}

/** The alert's name in the person's language, as it is stored. */
export async function nameJobAlert(
  supabase: SupabaseClient,
  target: JobAlertTarget,
  locale: Locale,
): Promise<string> {
  const dictionary = getDictionary(locale);

  if (target.type === "profile") {
    return dictionary.jobAlerts.profileName;
  }

  const names = await getJobAlertFilterNames(supabase, target.filters);

  return describeJobAlertFilters(
    target.filters,
    {
      kinds: dictionary.vacancies.kinds,
      formats: dictionary.vacancies.formats,
      levels: dictionary.vacancies.levels,
      paid: dictionary.jobAlerts.namePaid,
      everything: dictionary.jobAlerts.nameEverything,
    },
    names,
  );
}

export type CreateJobAlertResult =
  | { ok: true; alert: JobAlert }
  | { ok: false; code: JobAlertWriteErrorCode | "unavailable" };

export async function createJobAlert(
  supabase: SupabaseClient,
  userId: string,
  { target, name, notifyEmail }: { target: JobAlertTarget; name: string; notifyEmail: boolean },
): Promise<CreateJobAlertResult> {
  const params = target.type === "profile" ? PROFILE_MATCH_PARAMS : toJobAlertParams(target.filters);

  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ user_id: userId, name, mode: "vacancies", params, notify_email: notifyEmail })
    .select(ALERT_COLUMNS)
    .single();

  if (error || !data) {
    // Before the migration: no email column, no 'vacancies' mode.
    if (error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("saved_searches_mode_check")) {
      return { ok: false, code: "unavailable" };
    }
    return { ok: false, code: jobAlertWriteErrorCode(error) ?? "invalid" };
  }

  return { ok: true, alert: mapAlert(data as AlertRow) };
}

/** Switches the email on or off. False when there is no such alert of the person's. */
export async function setJobAlertEmail(
  supabase: SupabaseClient,
  userId: string,
  alertId: string,
  notifyEmail: boolean,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_searches")
    .update({ notify_email: notifyEmail })
    .eq("id", alertId)
    .eq("user_id", userId)
    .eq("mode", "vacancies")
    .select("id");

  return !error && Array.isArray(data) && data.length > 0;
}

export async function deleteJobAlert(
  supabase: SupabaseClient,
  userId: string,
  alertId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", alertId)
    .eq("user_id", userId)
    .eq("mode", "vacancies")
    .select("id");

  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * The unsubscribe link: every job alert of the person stops sending email. The
 * alerts stay and keep notifying on the site. Needs the service key.
 */
export async function turnOffJobAlertEmails(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  if (!admin) {
    return false;
  }

  const { error } = await admin
    .from("saved_searches")
    .update({ notify_email: false })
    .eq("user_id", userId)
    .eq("mode", "vacancies");

  if (error) {
    console.error("[job-alerts] unsubscribe failed:", error.message);
    return false;
  }

  return true;
}

// --- The morning run -------------------------------------------------------------------------

type FreshVacancyRow = VacancySummaryRow & {
  moderated_at: string | null;
  country_id: number | null;
  category_id: number | null;
  vacancy_skills?: Array<{ skill_id: number }> | null;
};

type FreshVacancy = {
  summary: VacancySummary;
  liveSince: number;
  match: MatchableVacancy;
};

type Found = { alert: AlertRow; target: JobAlertTarget; vacancies: FreshVacancy[] };

export type JobAlertRunResult = {
  /** Vacancies that went live in the window. */
  vacancies: number;
  alerts: number;
  /** People who got something. */
  people: number;
  emails: number;
  failedEmails: number;
};

const NOTHING: JobAlertRunResult = { vacancies: 0, alerts: 0, people: 0, emails: 0, failedEmails: 0 };

const PAGE_SIZE = 1000;

/** Every row of a query, page by page: the API stops at 1 000 rows without a word. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const chunk = (data ?? []) as T[];
    rows.push(...chunk);

    if (chunk.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function chunks<T>(list: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < list.length; index += size) {
    result.push(list.slice(index, index + size));
  }
  return result;
}

async function loadFreshVacancies(admin: SupabaseClient, now: number): Promise<FreshVacancy[]> {
  const since = now - JOB_ALERT_LIMITS.windowDays * DAY_MS;
  const sinceIso = new Date(since).toISOString();
  const companyJoin = "company:company_id!inner ( id, slug, name, logo_url, verified_at, moderation_status )";

  const { data, error } = await admin
    .from("vacancies")
    .select(
      `${SUMMARY_COLUMNS}, moderated_at, country_id, category_id, ${companyJoin}, ${NAME_JOINS}, vacancy_skills ( skill_id )`,
    )
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .gt("expires_at", new Date(now).toISOString())
    .eq("company.moderation_status", "approved")
    .or(`published_at.gt.${sinceIso},moderated_at.gt.${sinceIso}`)
    .order("published_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const fresh: FreshVacancy[] = [];

  for (const row of (data ?? []) as unknown as FreshVacancyRow[]) {
    const liveSince = vacancyLiveSince({ publishedAt: row.published_at, moderatedAt: row.moderated_at });
    if (liveSince === null || liveSince <= since) continue;

    const summary = mapVacancySummary(row, now);
    fresh.push({
      summary,
      liveSince,
      match: {
        kind: summary.kind,
        workFormats: summary.workFormats,
        experienceLevel: summary.experienceLevel,
        countryId: row.country_id,
        categoryId: row.category_id,
        skillIds: (row.vacancy_skills ?? []).map((link) => link.skill_id),
        hasPay: summary.pay !== null,
        title: summary.title,
      },
    });
  }

  // Newest first: that is the order the email lists them in.
  return fresh.sort((left, right) => right.liveSince - left.liveSince);
}

async function loadProfilesForMatching(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, ProfileForMatching>> {
  const profiles = new Map<string, ProfileForMatching>();

  if (userIds.length === 0) {
    return profiles;
  }

  const rows: Array<{ id: string; user_id: string; open_to: unknown; work_formats: unknown }> = [];
  for (const ids of chunks(userIds, 200)) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, user_id, open_to, work_formats")
      .in("user_id", ids);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
  }

  const skillsByProfile = new Map<string, number[]>();
  for (const ids of chunks(rows.map((row) => row.id), 200)) {
    const links = await fetchAll<{ profile_id: string; skill_id: number }>((from, to) =>
      admin.from("profile_skills").select("profile_id, skill_id").in("profile_id", ids).range(from, to),
    );
    for (const link of links) {
      skillsByProfile.set(link.profile_id, [...(skillsByProfile.get(link.profile_id) ?? []), link.skill_id]);
    }
  }

  for (const row of rows) {
    const formats = Array.isArray(row.work_formats) ? row.work_formats : [];
    profiles.set(row.user_id, {
      openTo: normalizeOpenTo(row.open_to),
      workFormats: WORK_FORMATS.filter((format) => formats.includes(format)),
      skillIds: skillsByProfile.get(row.id) ?? [],
    });
  }

  return profiles;
}

function siteBase(): string {
  return getSiteUrl().replace(/\/$/, "");
}

function emailItem(vacancy: VacancySummary, locale: Locale): JobAlertEmailItem {
  const copy = getDictionary(locale).vacancies;
  const formats = vacancy.workFormats.map((format) => copy.formats[format]).join(", ");
  const details = [
    copy.kinds[vacancy.kind],
    vacancy.pay ? formatVacancyPay(vacancy.pay, copy.pay, locale) : null,
    formats || null,
    formatVacancyPlace(vacancy.city, vacancy.countryName),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: vacancy.title,
    company: vacancy.company.name,
    details,
    url: `${siteBase()}/${locale}${buildVacancyPath(vacancy.slug)}`,
  };
}

function buildDigest(
  userId: string,
  recipient: { email: string; name: string; locale: Locale },
  found: Found[],
): SendEmailInput {
  const { locale } = recipient;
  const manageUrl = `${siteBase()}/${locale}${JOB_ALERTS_PATH}`;

  const sections: JobAlertEmailSection[] = found.map(({ alert, target, vacancies }) => ({
    name: target.type === "profile" ? getDictionary(locale).emails.jobAlert.profileMatch : alert.name,
    items: vacancies.slice(0, JOB_ALERT_LIMITS.listedPerAlert).map((vacancy) => emailItem(vacancy.summary, locale)),
    more: Math.max(0, vacancies.length - JOB_ALERT_LIMITS.listedPerAlert),
    moreUrl: target.type === "profile" ? manageUrl : `${siteBase()}/${locale}${jobAlertHref(target)}`,
  }));
  const total = new Set(found.flatMap((entry) => entry.vacancies.map((vacancy) => vacancy.summary.id))).size;

  const message = buildJobAlertDigestEmail({
    recipientName: recipient.name,
    sections,
    total,
    manageUrl,
    unsubscribeUrl: buildJobAlertUnsubscribePageUrl(locale, userId),
    locale,
  });

  const oneClick = buildJobAlertOneClickUrl(userId);

  return {
    to: recipient.email,
    ...message,
    headers: oneClick
      ? {
          "List-Unsubscribe": `<${oneClick}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  };
}

/**
 * The daily cron: vacancies that went live in the last days, matched against
 * every job alert. Each person gets at most one notification and one email,
 * with what is new for them: vacancies that went live after the alert was
 * made, not sent by it before, and not of a company they are in. An email
 * that fails to go leaves that person's matches for the next run.
 */
export async function runJobAlerts(now: number = Date.now()): Promise<JobAlertRunResult> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[job-alerts] SUPABASE_SERVICE_ROLE_KEY missing — no alerts sent");
    return NOTHING;
  }

  const keepSince = new Date(now - JOB_ALERT_LIMITS.keepDeliveriesDays * DAY_MS).toISOString();
  const { error: purgeError } = await admin.from("job_alert_deliveries").delete().lt("delivered_at", keepSince);
  if (purgeError) {
    console.error("[job-alerts] could not purge old deliveries:", purgeError.message);
  }

  const fresh = await loadFreshVacancies(admin, now);

  if (fresh.length === 0) {
    return NOTHING;
  }

  const alerts = await fetchAll<AlertRow>((from, to) =>
    admin
      .from("saved_searches")
      .select(ALERT_COLUMNS)
      .eq("mode", "vacancies")
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  if (alerts.length === 0) {
    return { ...NOTHING, vacancies: fresh.length };
  }

  const delivered = new Set<string>();
  for (const ids of chunks(fresh.map((vacancy) => vacancy.summary.id), 100)) {
    const rows = await fetchAll<{ saved_search_id: string; vacancy_id: string }>((from, to) =>
      admin.from("job_alert_deliveries").select("saved_search_id, vacancy_id").in("vacancy_id", ids).range(from, to),
    );
    for (const row of rows) delivered.add(`${row.saved_search_id}:${row.vacancy_id}`);
  }

  const userIds = Array.from(new Set(alerts.map((alert) => alert.user_id)));
  const ownCompanies = new Map<string, Set<string>>();
  for (const ids of chunks(userIds, 200)) {
    const rows = await fetchAll<{ user_id: string; company_id: string }>((from, to) =>
      admin
        .from("company_members")
        .select("user_id, company_id")
        .eq("status", "accepted")
        .in("user_id", ids)
        .range(from, to),
    );
    for (const row of rows) {
      ownCompanies.set(row.user_id, (ownCompanies.get(row.user_id) ?? new Set()).add(row.company_id));
    }
  }

  const targets = new Map(alerts.map((alert) => [alert.id, readJobAlertTarget(alert.params)] as const));
  const profiles = await loadProfilesForMatching(
    admin,
    Array.from(new Set(alerts.filter((alert) => targets.get(alert.id)?.type === "profile").map((alert) => alert.user_id))),
  );

  const perUser = new Map<string, Found[]>();

  for (const alert of alerts) {
    const target = targets.get(alert.id)!;
    const createdAt = Date.parse(alert.created_at);
    const own = ownCompanies.get(alert.user_id);
    const profile = target.type === "profile" ? profiles.get(alert.user_id) : null;

    if (target.type === "profile" && !profile) continue;

    const vacancies = fresh.filter(
      (vacancy) =>
        vacancy.liveSince > createdAt &&
        !delivered.has(`${alert.id}:${vacancy.summary.id}`) &&
        !own?.has(vacancy.summary.company.id) &&
        (target.type === "profile"
          ? vacancyMatchesProfile(vacancy.match, profile!)
          : vacancyMatchesFilters(vacancy.match, target.filters)),
    );

    if (vacancies.length > 0) {
      perUser.set(alert.user_id, [...(perUser.get(alert.user_id) ?? []), { alert, target, vacancies }]);
    }
  }

  // Emails first: whoever's email fails keeps their matches for tomorrow.
  const outgoing: Array<{ userId: string; input: SendEmailInput }> = [];

  for (const [userId, found] of perUser) {
    const emailed = found.filter((entry) => entry.alert.notify_email);
    if (emailed.length === 0) continue;

    try {
      const recipient = await loadEmailRecipient(admin, userId);
      // Never to an address nobody confirmed: it may not be theirs.
      if (!recipient || !recipient.emailConfirmed) continue;
      outgoing.push({ userId, input: buildDigest(userId, recipient, emailed) });
    } catch (error) {
      console.error("[job-alerts] could not prepare an email", { userId, error });
    }
  }

  const results = await sendEmailBatch(outgoing.map((entry) => entry.input));
  const emailedUsers = new Set<string>();
  const failedUsers = new Set<string>();
  outgoing.forEach((entry, index) => {
    if (results[index]?.sent) emailedUsers.add(entry.userId);
    else if (results[index]?.error !== "email_not_configured") failedUsers.add(entry.userId);
  });

  let people = 0;

  for (const [userId, found] of perUser) {
    if (failedUsers.has(userId)) continue;

    const rows = found.flatMap(({ alert, vacancies }) =>
      vacancies.map((vacancy) => ({
        saved_search_id: alert.id,
        vacancy_id: vacancy.summary.id,
        emailed: Boolean(alert.notify_email) && emailedUsers.has(userId),
      })),
    );

    const { error } = await admin
      .from("job_alert_deliveries")
      .upsert(rows, { onConflict: "saved_search_id,vacancy_id", ignoreDuplicates: true });

    if (error) {
      console.error("[job-alerts] could not record deliveries", { userId, error: error.message });
      continue;
    }

    const unique = new Map<string, VacancySummary>();
    for (const entry of found) {
      for (const vacancy of entry.vacancies) unique.set(vacancy.summary.id, vacancy.summary);
    }
    const single = unique.size === 1 ? [...unique.values()][0] : null;

    await createNotifications(admin, {
      recipientUserId: userId,
      actorUserId: null,
      type: "vacancy_match",
      targetType: single ? "vacancy" : null,
      targetId: single?.id ?? null,
      metadata: {
        matchCount: unique.size,
        searchName: found.length === 1 && found[0].target.type === "filters" ? found[0].alert.name : undefined,
        vacancyId: single?.id,
        vacancySlug: single?.slug,
        vacancyTitle: single?.title,
        companyName: single?.company.name,
      },
    });

    people += 1;
  }

  return {
    vacancies: fresh.length,
    alerts: alerts.length,
    people,
    emails: emailedUsers.size,
    failedEmails: failedUsers.size,
  };
}
