import { isPortfolioPath, isShareTag, SHARE_TAG_MEDIUM } from "@/lib/share-links";
import type { ViewSource, ViewTargetType } from "@/lib/view-tracking";

// ---------------------------------------------------------------------------
// Product metrics for the admin panel (plan part 3). Pure: the rows come from
// admin_metrics_users() and admin_metrics_view_rollup() in
// database/2026-09-26-product-metrics.sql, and everything here is plain
// arithmetic over them, so it is unit-tested without a database.
//
// Definitions:
//   * activated author — has at least one published project AND at least one
//     view of their portfolio (profile or project) from outside the site
//     (source external or direct). Activated at whichever came second.
//   * returned after N days — last activity is at least N days after sign-up.
//     Counted only for accounts that are at least N days old.
//   * platform admins are left out of every number: the founder's own account
//     would otherwise be most of the data.
//   * signed up through a portfolio (plan part 6) — the first touch was a link
//     the share loop tagged (README badge, QR code, PDF résumé), or it landed
//     on someone's profile or project page from outside the site.
// ---------------------------------------------------------------------------

export const METRICS_WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const HOUR_MS = 60 * 60 * 1000;
const TOP_LIST_LIMIT = 8;

export type MetricsUserRow = {
  account_id: string;
  signed_up_at: string;
  email_confirmed: boolean;
  last_active_at: string | null;
  first_project_at: string | null;
  first_external_view_at: string | null;
  signup_source_recorded: boolean;
  signup_referrer_host: string | null;
  signup_utm_source: string | null;
  is_admin: boolean;
  /** Returned since 2026-09-28-share-loop.sql; missing before it runs. */
  signup_utm_medium?: string | null;
  signup_landing_path?: string | null;
};

export type MetricsViewRollupRow = {
  /** Monday of the UTC week, `YYYY-MM-DD`. */
  week_start: string;
  target_type: ViewTargetType;
  source: ViewSource;
  referrer_host: string | null;
  owner_is_admin: boolean;
  /** bigint: PostgREST may hand it over as a string. */
  views: number | string;
};

export type WeekMetrics = {
  /** Monday of the UTC week, `YYYY-MM-DD`. */
  start: string;
  signups: number;
  confirmedSignups: number;
  newActivated: number;
  /** Portfolio views from outside the site (external + direct). */
  outsideViews: number;
  /** Portfolio views from other pages of the site. */
  internalViews: number;
};

export type RetentionCell = { returned: number; eligible: number };

export type CohortMetrics = {
  start: string;
  size: number;
  withFirstProject: number;
  medianHoursToFirstProject: number | null;
  /** null while no account in the cohort is old enough to tell. */
  returnedAfter7: RetentionCell | null;
  returnedAfter30: RetentionCell | null;
};

export type RankedCount = { label: string; count: number };

export type ProductMetrics = {
  weeks: WeekMetrics[];
  activation: { total: number; thisWeek: number };
  funnel: {
    accounts: number;
    withFirstProject: number;
    medianHoursToFirstProject: number | null;
  };
  cohorts: CohortMetrics[];
  /** Portfolio views from other sites in the window, by source name. */
  referrers: RankedCount[];
  /** Portfolio views without a referrer in the window. */
  directViews: number;
  /** Sign-ups in the window with a recorded source, by source name. */
  signupSources: RankedCount[];
  /** Recorded as a direct visit (no referrer, no UTM). */
  directSignups: number;
  /** No consent, or signed up before the source was recorded. */
  unattributedSignups: number;
  /** Sign-ups in the window that came through someone's portfolio. */
  portfolioSignups: {
    total: number;
    /**
     * `tag:badge`, `tag:qr`, `tag:resume` for the tagged links, `direct` for a
     * portfolio link opened with no referrer, otherwise the source name.
     */
    channels: RankedCount[];
  };
  excludedAdmins: number;
};

export const PORTFOLIO_DIRECT_CHANNEL = "direct";

/**
 * How a sign-up came through a portfolio, or null when it did not (or its
 * source is unknown). Mirrors the sign-up source ranking: a UTM source wins
 * over the referring host.
 */
export function portfolioSignupChannel(user: MetricsUserRow): string | null {
  if (!user.signup_source_recorded) {
    return null;
  }

  if (user.signup_utm_medium === SHARE_TAG_MEDIUM && isShareTag(user.signup_utm_source)) {
    return `tag:${user.signup_utm_source}`;
  }

  if (!isPortfolioPath(user.signup_landing_path)) {
    return null;
  }

  if (user.signup_utm_source) {
    return user.signup_utm_source;
  }

  return user.signup_referrer_host
    ? labelReferrerHost(user.signup_referrer_host)
    : PORTFOLIO_DIRECT_CHANNEL;
}

export function startOfUtcWeek(date: Date): Date {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay: 0 is Sunday. Weeks start on Monday, as in Postgres date_trunc.
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The Mondays of the last `count` weeks, oldest first, this week last. */
export function lastWeekStarts(now: Date, count: number): string[] {
  const current = startOfUtcWeek(now).getTime();
  return Array.from({ length: count }, (_, index) =>
    toIsoDate(new Date(current - (count - 1 - index) * WEEK_MS)),
  );
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function toTime(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function activatedAt(user: MetricsUserRow): number | null {
  const project = toTime(user.first_project_at);
  const view = toTime(user.first_external_view_at);
  return project === null || view === null ? null : Math.max(project, view);
}

function hoursToFirstProject(user: MetricsUserRow): number | null {
  const signedUp = toTime(user.signed_up_at);
  const project = toTime(user.first_project_at);
  if (signedUp === null || project === null) {
    return null;
  }
  return Math.max(0, project - signedUp) / HOUR_MS;
}

function retention(
  users: MetricsUserRow[],
  days: number,
  now: number,
): RetentionCell | null {
  let eligible = 0;
  let returned = 0;

  for (const user of users) {
    const signedUp = toTime(user.signed_up_at);
    if (signedUp === null || signedUp > now - days * DAY_MS) {
      continue;
    }
    eligible += 1;
    const lastActive = toTime(user.last_active_at);
    if (lastActive !== null && lastActive >= signedUp + days * DAY_MS) {
      returned += 1;
    }
  }

  return eligible === 0 ? null : { returned, eligible };
}

// Known sources, so that "lnkd.in" and "linkedin.com" read as one channel.
// Matched against the host and each of its parent domains.
const REFERRER_LABELS: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "lnkd.in": "LinkedIn",
  "com.linkedin.android": "LinkedIn",
  "t.me": "Telegram",
  "telegram.org": "Telegram",
  "org.telegram.messenger": "Telegram",
  "github.com": "GitHub",
  "gitlab.com": "GitLab",
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "instagram.com": "Instagram",
  "x.com": "X",
  "twitter.com": "X",
  "t.co": "X",
  "threads.net": "Threads",
  "youtube.com": "YouTube",
  "reddit.com": "Reddit",
  "discord.com": "Discord",
  "dou.ua": "DOU",
  "djinni.co": "Djinni",
  "behance.net": "Behance",
  "dribbble.com": "Dribbble",
  "bing.com": "Bing",
  "duckduckgo.com": "DuckDuckGo",
  "chatgpt.com": "ChatGPT",
  "chat.openai.com": "ChatGPT",
  "perplexity.ai": "Perplexity",
  "claude.ai": "Claude",
  "gemini.google.com": "Gemini",
};

export function labelReferrerHost(host: string): string {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  const parts = normalized.split(".");

  for (let index = 0; index < parts.length - 1; index += 1) {
    const candidate = parts.slice(index).join(".");
    if (REFERRER_LABELS[candidate]) {
      return REFERRER_LABELS[candidate];
    }
  }

  // google.com, google.com.ua, com.google.android.gm (Gmail app), …
  if (/(^|\.)google\.[a-z.]+$/.test(normalized) || normalized.startsWith("com.google.")) {
    return "Google";
  }

  return normalized;
}

function rank(counts: Map<string, number>): RankedCount[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, TOP_LIST_LIMIT);
}

function increment(counts: Map<string, number>, key: string, by = 1) {
  counts.set(key, (counts.get(key) ?? 0) + by);
}

export function buildProductMetrics({
  users,
  views,
  now,
  weekCount = METRICS_WEEKS,
}: {
  users: MetricsUserRow[];
  views: MetricsViewRollupRow[];
  now: Date;
  weekCount?: number;
}): ProductMetrics {
  const nowTime = now.getTime();
  const weekStarts = lastWeekStarts(now, weekCount);
  const windowStart = Date.parse(`${weekStarts[0]}T00:00:00Z`);
  const weekIndex = (time: number) => {
    const index = Math.floor((time - windowStart) / WEEK_MS);
    return index >= 0 && index < weekCount ? index : null;
  };

  const people = users.filter((user) => !user.is_admin);
  const weeks: WeekMetrics[] = weekStarts.map((start) => ({
    start,
    signups: 0,
    confirmedSignups: 0,
    newActivated: 0,
    outsideViews: 0,
    internalViews: 0,
  }));
  const cohortMembers: MetricsUserRow[][] = weekStarts.map(() => []);

  let activatedTotal = 0;
  const signupSources = new Map<string, number>();
  let directSignups = 0;
  let unattributedSignups = 0;
  const portfolioChannels = new Map<string, number>();
  let portfolioSignupsTotal = 0;

  for (const user of people) {
    const signedUp = toTime(user.signed_up_at);
    const signupWeek = signedUp === null ? null : weekIndex(signedUp);

    if (signupWeek !== null) {
      weeks[signupWeek].signups += 1;
      if (user.email_confirmed) {
        weeks[signupWeek].confirmedSignups += 1;
      }
      cohortMembers[signupWeek].push(user);

      if (!user.signup_source_recorded) {
        unattributedSignups += 1;
      } else if (user.signup_utm_source) {
        increment(signupSources, user.signup_utm_source);
      } else if (user.signup_referrer_host) {
        increment(signupSources, labelReferrerHost(user.signup_referrer_host));
      } else {
        directSignups += 1;
      }

      const channel = portfolioSignupChannel(user);
      if (channel) {
        portfolioSignupsTotal += 1;
        increment(portfolioChannels, channel);
      }
    }

    const activated = activatedAt(user);
    if (activated !== null) {
      activatedTotal += 1;
      const activationWeek = weekIndex(activated);
      if (activationWeek !== null) {
        weeks[activationWeek].newActivated += 1;
      }
    }
  }

  const referrers = new Map<string, number>();
  let directViews = 0;

  for (const row of views) {
    // Portfolio views only: articles, vacancies and company pages are not
    // someone's portfolio.
    if (row.owner_is_admin || (row.target_type !== "profile" && row.target_type !== "project")) {
      continue;
    }
    const index = weekIndex(Date.parse(`${row.week_start}T00:00:00Z`));
    if (index === null) {
      continue;
    }
    const count = Number(row.views) || 0;

    if (row.source === "internal") {
      weeks[index].internalViews += count;
      continue;
    }

    weeks[index].outsideViews += count;
    if (row.source === "external" && row.referrer_host) {
      increment(referrers, labelReferrerHost(row.referrer_host), count);
    } else {
      directViews += count;
    }
  }

  const cohorts: CohortMetrics[] = weekStarts.map((start, index) => {
    const members = cohortMembers[index];
    const hours = members
      .map(hoursToFirstProject)
      .filter((value): value is number => value !== null);

    return {
      start,
      size: members.length,
      withFirstProject: hours.length,
      medianHoursToFirstProject: median(hours),
      returnedAfter7: retention(members, 7, nowTime),
      returnedAfter30: retention(members, 30, nowTime),
    };
  });

  const allHours = people
    .map(hoursToFirstProject)
    .filter((value): value is number => value !== null);

  return {
    weeks,
    activation: {
      total: activatedTotal,
      thisWeek: weeks[weeks.length - 1]?.newActivated ?? 0,
    },
    funnel: {
      accounts: people.length,
      withFirstProject: allHours.length,
      medianHoursToFirstProject: median(allHours),
    },
    cohorts,
    referrers: rank(referrers),
    directViews,
    signupSources: rank(signupSources),
    directSignups,
    unattributedSignups,
    portfolioSignups: { total: portfolioSignupsTotal, channels: rank(portfolioChannels) },
    excludedAdmins: users.length - people.length,
  };
}
