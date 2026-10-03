import { lastWeekStarts, median, METRICS_WEEKS } from "@/lib/product-metrics";

// ---------------------------------------------------------------------------
// Hiring metrics for the admin panel (hiring stage 8.4, docs/hiring.md).
// Pure: the rows come from admin_metrics_hiring_vacancies(),
// admin_metrics_hiring_applications() and admin_metrics_hiring_signals(), and
// this is arithmetic over them. Applications by platform admins are already
// left out by the database.
//
// Definitions:
//   * open vacancy — published, approved, of a visible company, not past its
//     end date;
//   * a reply within 14 days — the vacancy's first application came at most
//     14 days after it went out; counted among vacancies at least 14 days old
//     (or younger ones that already got one);
//   * viewed within 7 days — the team opened the application at most 7 days
//     after it came; counted among applications at least 7 days old (or
//     already viewed). One withdrawn before anyone looked is left out: there
//     was nothing left to read. This is the health number: candidates leave
//     when nobody answers.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const HOUR_MS = 60 * 60 * 1000;

export const FIRST_REPLY_DAYS = 14;
export const VIEWED_WITHIN_DAYS = 7;

type Count = number | string | null;

export type HiringVacancyRow = {
  vacancy_id: string;
  company_id: string;
  status: string;
  moderation_status: string;
  company_visible: boolean;
  published_at: string | null;
  expires_at: string | null;
  first_application_at: string | null;
  applications: Count;
};

export type HiringApplicationRow = {
  created_at: string;
  viewed_at: string | null;
  status: string;
};

export type HiringSignalsRow = {
  alerts: Count;
  email_alerts: Count;
  alert_people: Count;
  profile_alerts: Count;
  delivered_30d: Count;
  emailed_30d: Count;
  company_opens_30d: Count;
  opening_companies_30d: Count;
};

export type ShareCell = { part: number; whole: number };

export type HiringMetrics = {
  openVacancies: number;
  openCompanies: number;
  /** Applications per week, oldest first, this week last. */
  weeks: Array<{ start: string; applications: number }>;
  applicationsInWindow: number;
  replyWithin14Days: ShareCell;
  medianHoursToFirstApplication: number | null;
  viewedWithin7Days: ShareCell;
  alerts: {
    alerts: number;
    emailAlerts: number;
    people: number;
    profileAlerts: number;
    delivered30Days: number;
    emailed30Days: number;
  };
  companyContactOpens: { opens30Days: number; companies30Days: number };
};

function toTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function toCount(value: Count): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function buildHiringMetrics({
  vacancies,
  applications,
  signals,
  now,
  weekCount = METRICS_WEEKS,
}: {
  vacancies: HiringVacancyRow[];
  applications: HiringApplicationRow[];
  signals: HiringSignalsRow | null;
  now: Date;
  weekCount?: number;
}): HiringMetrics {
  const nowTime = now.getTime();
  const weekStarts = lastWeekStarts(now, weekCount);
  const windowStart = Date.parse(`${weekStarts[0]}T00:00:00Z`);

  const visible = vacancies.filter((row) => row.moderation_status === "approved" && row.company_visible);

  const open = visible.filter((row) => {
    const expires = toTime(row.expires_at);
    return row.status === "published" && expires !== null && expires > nowTime;
  });

  const replyWithin14Days: ShareCell = { part: 0, whole: 0 };
  const hoursToFirst: number[] = [];

  for (const row of visible) {
    const published = toTime(row.published_at);
    if (published === null) continue;

    const first = toTime(row.first_application_at);
    const repliedInTime = first !== null && first - published <= FIRST_REPLY_DAYS * DAY_MS;

    if (published <= nowTime - FIRST_REPLY_DAYS * DAY_MS || repliedInTime) {
      replyWithin14Days.whole += 1;
      if (repliedInTime) replyWithin14Days.part += 1;
    }

    if (first !== null) {
      hoursToFirst.push(Math.max(0, first - published) / HOUR_MS);
    }
  }

  const weeks = weekStarts.map((start) => ({ start, applications: 0 }));
  const viewedWithin7Days: ShareCell = { part: 0, whole: 0 };
  let applicationsInWindow = 0;

  for (const row of applications) {
    const created = toTime(row.created_at);
    if (created === null) continue;

    const index = Math.floor((created - windowStart) / WEEK_MS);
    if (index >= 0 && index < weekCount) {
      weeks[index].applications += 1;
      applicationsInWindow += 1;
    }

    const viewed = toTime(row.viewed_at);
    if (row.status === "withdrawn" && viewed === null) continue;

    const viewedInTime = viewed !== null && viewed - created <= VIEWED_WITHIN_DAYS * DAY_MS;
    if (created <= nowTime - VIEWED_WITHIN_DAYS * DAY_MS || viewedInTime) {
      viewedWithin7Days.whole += 1;
      if (viewedInTime) viewedWithin7Days.part += 1;
    }
  }

  return {
    openVacancies: open.length,
    openCompanies: new Set(open.map((row) => row.company_id)).size,
    weeks,
    applicationsInWindow,
    replyWithin14Days,
    medianHoursToFirstApplication: median(hoursToFirst),
    viewedWithin7Days,
    alerts: {
      alerts: toCount(signals?.alerts ?? 0),
      emailAlerts: toCount(signals?.email_alerts ?? 0),
      people: toCount(signals?.alert_people ?? 0),
      profileAlerts: toCount(signals?.profile_alerts ?? 0),
      delivered30Days: toCount(signals?.delivered_30d ?? 0),
      emailed30Days: toCount(signals?.emailed_30d ?? 0),
    },
    companyContactOpens: {
      opens30Days: toCount(signals?.company_opens_30d ?? 0),
      companies30Days: toCount(signals?.opening_companies_30d ?? 0),
    },
  };
}
