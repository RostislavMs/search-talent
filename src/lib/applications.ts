// Applications (hiring stage 8.3, docs/hiring.md): applying to a vacancy with
// a portfolio. Pure helpers shared by the API, the pages and the tests; the
// rules they mirror live in database/2026-10-02-applications.sql, which stays
// the authority.

import type { OpenToOption } from "@/lib/open-to";

/**
 * new → viewed (the team opened it) → shortlisted → rejected or hired; the
 * candidate may withdraw at any point.
 */
export const APPLICATION_STATUSES = [
  "new",
  "viewed",
  "shortlisted",
  "rejected",
  "hired",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** What the team may set (set_vacancy_application_status). */
export const TEAM_APPLICATION_STATUSES = ["viewed", "shortlisted", "rejected", "hired"] as const;
export type TeamApplicationStatus = (typeof TEAM_APPLICATION_STATUSES)[number];

export const APPLICATION_LIMITS = {
  messageMax: 1000,
  projectsMin: 1,
  projectsMax: 3,
  /** Applications a person may send a day (apply_to_vacancy). */
  perDay: 20,
  /** Kept this long after the vacancy closed or ran out (purge_old_vacancy_applications). */
  keepMonths: 12,
  /** Applications marked viewed in one request. */
  viewedBatchMax: 200,
} as const;

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function normalizeApplicationStatus(value: unknown): ApplicationStatus {
  return isOneOf(APPLICATION_STATUSES, value) ? value : "new";
}

/** Rejected or hired: the team has made up its mind. */
export function isApplicationDecided(status: ApplicationStatus): boolean {
  return status === "rejected" || status === "hired";
}

export type ApplicantNotice = "viewed" | "shortlisted" | "rejected" | "hired";

/**
 * What the candidate hears after a move, if anything: the first time the team
 * opens the application, and every decision. Moving back to "viewed" (taking
 * someone off the shortlist, undoing a rejection) is silent: the candidate
 * sees the current state in "My applications" anyway.
 */
export function applicantNoticeFor(
  previous: ApplicationStatus,
  next: ApplicationStatus,
): ApplicantNotice | null {
  if (previous === next || previous === "withdrawn") {
    return null;
  }
  if (next === "viewed") {
    return previous === "new" ? "viewed" : null;
  }
  return next === "shortlisted" || next === "rejected" || next === "hired" ? next : null;
}

export type EmailedApplicantNotice = Exclude<ApplicantNotice, "viewed">;

/** Decisions also go by email; "viewed" stays a notification. */
export function isApplicantNoticeEmailed(notice: ApplicantNotice): notice is EmailedApplicantNotice {
  return notice !== "viewed";
}

// --- The team's list -----------------------------------------------------------------

export const APPLICATION_TEAM_FILTERS = [
  "all",
  "undecided",
  "shortlisted",
  "hired",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationTeamFilter = (typeof APPLICATION_TEAM_FILTERS)[number];

export function parseApplicationTeamFilter(value: unknown): ApplicationTeamFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return isOneOf(APPLICATION_TEAM_FILTERS, raw) ? raw : "all";
}

/** "All" leaves out withdrawn ones: there is nothing left to read in them. */
export function applicationMatchesTeamFilter(
  status: ApplicationStatus,
  filter: ApplicationTeamFilter,
): boolean {
  switch (filter) {
    case "all":
      return status !== "withdrawn";
    case "undecided":
      return status === "new" || status === "viewed";
    default:
      return status === filter;
  }
}

/** How many applications each tab of the team's list holds. */
export function countApplicationsByFilter(
  statuses: readonly ApplicationStatus[],
): Record<ApplicationTeamFilter, number> {
  const counts = Object.fromEntries(APPLICATION_TEAM_FILTERS.map((filter) => [filter, 0])) as Record<
    ApplicationTeamFilter,
    number
  >;
  for (const status of statuses) {
    for (const filter of APPLICATION_TEAM_FILTERS) {
      if (applicationMatchesTeamFilter(status, filter)) {
        counts[filter] += 1;
      }
    }
  }
  return counts;
}

// --- The vacancy page ------------------------------------------------------------------

/**
 * What the vacancy page offers the visitor instead of (or as) "Apply":
 *   sign_in       — a guest;
 *   team          — the company's own vacancy;
 *   closed        — closed, expired, or not out at all;
 *   applied       — there is an application already (withdrawn included);
 *   confirm_email — the company would get an unconfirmed email;
 *   need_profile  — no public page yet (no username);
 *   need_project  — nothing published to apply with;
 *   ready         — the form.
 */
export type ApplyState =
  | "sign_in"
  | "team"
  | "closed"
  | "applied"
  | "confirm_email"
  | "need_profile"
  | "need_project"
  | "ready";

export function resolveApplyState(input: {
  signedIn: boolean;
  isTeam: boolean;
  vacancyOpen: boolean;
  hasApplication: boolean;
  emailConfirmed: boolean;
  hasProfile: boolean;
  projectsCount: number;
}): ApplyState {
  if (input.isTeam) return "team";
  if (input.hasApplication) return "applied";
  if (!input.vacancyOpen) return "closed";
  if (!input.signedIn) return "sign_in";
  if (!input.emailConfirmed) return "confirm_email";
  if (!input.hasProfile) return "need_profile";
  if (input.projectsCount < APPLICATION_LIMITS.projectsMin) return "need_project";
  return "ready";
}

// --- Refusals ------------------------------------------------------------------------------

/** What apply_to_vacancy() answers instead of 'ok'. */
export const APPLY_REFUSALS = [
  "unauthorized",
  "email_unconfirmed",
  "not_open",
  "own_company",
  "no_profile",
  "message_long",
  "invalid_projects",
  "already_applied",
  "daily_limit",
] as const;
export type ApplyRefusal = (typeof APPLY_REFUSALS)[number];

export const APPLY_REFUSAL_HTTP_STATUS: Record<ApplyRefusal, number> = {
  unauthorized: 401,
  email_unconfirmed: 403,
  not_open: 409,
  own_company: 403,
  no_profile: 403,
  message_long: 400,
  invalid_projects: 400,
  already_applied: 409,
  daily_limit: 429,
};

export function toApplyRefusal(value: unknown): ApplyRefusal {
  return isOneOf(APPLY_REFUSALS, value) ? value : "not_open";
}

// --- Addresses -------------------------------------------------------------------------------

export const MY_APPLICATIONS_PATH = "/my-space/applications";

/** The team's list of applications to one vacancy. */
export function buildTeamApplicationsPath(vacancyId: string): string {
  return `/my-space/vacancies/${vacancyId}`;
}

// --- Shapes the pages work with ------------------------------------------------------------------

export type ApplicationProject = {
  id: string;
  title: string;
  slug: string | null;
  coverUrl: string | null;
  kind: string | null;
};

/** The candidate as the team sees them: the public profile, or null when it is hidden. */
export type ApplicantProfile = {
  userId: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  openTo: OpenToOption[];
};

export type TeamApplication = {
  id: string;
  status: ApplicationStatus;
  message: string;
  projects: ApplicationProject[];
  createdAt: string;
  viewedAt: string | null;
  withdrawnAt: string | null;
  applicantUserId: string;
  applicant: ApplicantProfile | null;
  /** Null when the database gave none: withdrawn, or the vacancy is hidden. */
  contacts: { email: string | null; phone: string | null } | null;
};

export type MyApplication = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  statusChangedAt: string | null;
  projects: ApplicationProject[];
  /** Null when the vacancy is no longer visible (hidden by moderation). */
  vacancy: {
    id: string;
    slug: string;
    title: string;
    state: "draft" | "open" | "closed" | "expired";
    company: { slug: string; name: string; logoUrl: string | null };
  } | null;
};
