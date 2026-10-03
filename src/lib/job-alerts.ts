// Job alerts (hiring stage 8.4, docs/hiring.md). Pure helpers shared by the
// API, the pages, the daily cron and the tests. The database holds the hard
// rules (10 alerts a person, the same filters once).
//
// An alert is a saved search in mode 'vacancies'. Its params are either the
// /jobs filters, stored exactly as the address carries them ({"kind":
// "internship", "country": "12"}), or {"match": "profile"}: vacancies that
// fit the person's «Відкрито до…», skills and work format.

import type { OpenToOption } from "@/lib/open-to";
import type { WorkFormat } from "@/lib/profile-sections";
import {
  EMPTY_VACANCY_FILTERS,
  VACANCY_KINDS,
  buildJobsHref,
  parseVacancyFilters,
  type VacancyFilters,
  type VacancyKind,
  type VacancyLevel,
} from "@/lib/vacancies";

export const JOB_ALERTS_PATH = "/my-space/job-alerts";
export const JOB_ALERTS_UNSUBSCRIBE_PATH = "/job-alerts/unsubscribe";

export const JOB_ALERT_LIMITS = {
  /** limit_job_alerts() */
  perPerson: 10,
  nameMax: 120,
  /** Vacancies listed per alert in one email; the rest are behind a link. */
  listedPerAlert: 10,
  /** How far back the morning run looks for vacancies that went live. */
  windowDays: 8,
  /** Deliveries are kept this long: the alerts page shows the latest ones. */
  keepDeliveriesDays: 90,
} as const;

/** The /jobs filters an alert follows: everything but the page. */
export type JobAlertFilters = Omit<VacancyFilters, "page">;

export type JobAlertTarget = { type: "profile" } | { type: "filters"; filters: JobAlertFilters };

export const PROFILE_MATCH_PARAMS = { match: "profile" } as const;

/** The filters of a /jobs page without its page number. */
export function withoutPage(filters: VacancyFilters): JobAlertFilters {
  const { page: _page, ...rest } = filters;
  void _page;
  return rest;
}

/**
 * The filters as they are stored: the address's own parameters, only the ones
 * that narrow something, as strings. Same filters, same object, so the
 * database's "once per person" check catches a repeat.
 */
export function toJobAlertParams(filters: Partial<JobAlertFilters>): Record<string, string> {
  const href = buildJobsHref({ ...filters, page: 1 });
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  return Object.fromEntries(new URLSearchParams(query).entries());
}

/** Reads whatever the request or the database holds; unknown keys are dropped. */
export function readJobAlertFilters(params: unknown): JobAlertFilters {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return withoutPage(EMPTY_VACANCY_FILTERS);
  }

  const strings: Record<string, string> = {};
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (typeof value === "string") {
      strings[key] = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      strings[key] = String(value);
    }
  }

  return withoutPage(parseVacancyFilters(strings));
}

export function readJobAlertTarget(params: unknown): JobAlertTarget {
  if (
    params &&
    typeof params === "object" &&
    !Array.isArray(params) &&
    (params as Record<string, unknown>).match === "profile"
  ) {
    return { type: "profile" };
  }
  return { type: "filters", filters: readJobAlertFilters(params) };
}

/** Where an alert leads: its /jobs list, or the alerts page for "fits me". */
export function jobAlertHref(target: JobAlertTarget): string {
  return target.type === "profile" ? JOB_ALERTS_PATH : buildJobsHref({ ...target.filters, page: 1 });
}

/** Whether two sets of filters are the same alert. */
export function sameJobAlertFilters(left: Partial<JobAlertFilters>, right: Partial<JobAlertFilters>): boolean {
  return buildJobsHref({ ...left, page: 1 }) === buildJobsHref({ ...right, page: 1 });
}

// --- Names ---------------------------------------------------------------------------------

export type JobAlertNameLabels = {
  kinds: Record<VacancyKind, string>;
  formats: Record<string, string>;
  levels: Record<VacancyLevel, string>;
  /** "with pay shown" */
  paid: string;
  /** The name of an alert without filters: every new vacancy. */
  everything: string;
};

/**
 * "Internship · Remote · React · «designer»" — what the person sees in the
 * list and in the email. Names of the place, field and skill come from the
 * database; anything unknown is left out.
 */
export function describeJobAlertFilters(
  filters: JobAlertFilters,
  labels: JobAlertNameLabels,
  names: { country?: string | null; category?: string | null; skill?: string | null } = {},
): string {
  const parts = [
    filters.kind ? labels.kinds[filters.kind] : null,
    filters.format ? labels.formats[filters.format] : null,
    filters.level ? labels.levels[filters.level] : null,
    filters.categoryId ? names.category : null,
    filters.skillId ? names.skill : null,
    filters.countryId ? names.country : null,
    filters.q ? `«${filters.q}»` : null,
    filters.paid ? labels.paid : null,
  ].filter((part): part is string => Boolean(part && part.trim()));

  const name = parts.length > 0 ? parts.join(" · ") : labels.everything;
  return name.length > JOB_ALERT_LIMITS.nameMax
    ? `${name.slice(0, JOB_ALERT_LIMITS.nameMax - 1).trimEnd()}…`
    : name;
}

// --- Matching ------------------------------------------------------------------------------

/** What the morning run knows about a vacancy that went live. */
export type MatchableVacancy = {
  kind: VacancyKind;
  workFormats: readonly string[];
  experienceLevel: VacancyLevel | null;
  countryId: number | null;
  categoryId: number | null;
  skillIds: readonly number[];
  hasPay: boolean;
  title: string;
};

/** `_`, `%` and `*` mean nothing special to a person typing a search. */
function normalizeSearch(value: string): string {
  return value.replace(/\*/g, " ").trim().toLocaleLowerCase();
}

/** The same test /jobs applies (listOpenVacancies), in memory. */
export function vacancyMatchesFilters(vacancy: MatchableVacancy, filters: JobAlertFilters): boolean {
  if (filters.kind && vacancy.kind !== filters.kind) return false;
  if (filters.format && !vacancy.workFormats.includes(filters.format)) return false;
  if (filters.level && vacancy.experienceLevel !== filters.level) return false;
  if (filters.countryId && vacancy.countryId !== filters.countryId) return false;
  if (filters.categoryId && vacancy.categoryId !== filters.categoryId) return false;
  if (filters.skillId && !vacancy.skillIds.includes(filters.skillId)) return false;
  if (filters.paid && !vacancy.hasPay) return false;

  const query = normalizeSearch(filters.q);
  if (query && !vacancy.title.toLocaleLowerCase().includes(query)) return false;

  return true;
}

export type ProfileForMatching = {
  openTo: readonly OpenToOption[];
  workFormats: readonly WorkFormat[];
  skillIds: readonly number[];
};

/** «Відкрито до…» options a vacancy can answer: everything but mentoring. */
export function vacancyKindsFromOpenTo(openTo: readonly OpenToOption[]): VacancyKind[] {
  return VACANCY_KINDS.filter((kind) => openTo.includes(kind));
}

/**
 * "Fits me": the kind is one the person is open to, they share a skill (when
 * both list any) and a work format (when both name one). Without a status the
 * alert matches nothing: the page asks to set «Відкрито до…» first.
 */
export function vacancyMatchesProfile(vacancy: MatchableVacancy, profile: ProfileForMatching): boolean {
  if (!vacancyKindsFromOpenTo(profile.openTo).includes(vacancy.kind)) {
    return false;
  }

  if (
    vacancy.skillIds.length > 0 &&
    profile.skillIds.length > 0 &&
    !vacancy.skillIds.some((skillId) => profile.skillIds.includes(skillId))
  ) {
    return false;
  }

  if (
    vacancy.workFormats.length > 0 &&
    profile.workFormats.length > 0 &&
    !vacancy.workFormats.some((format) => (profile.workFormats as readonly string[]).includes(format))
  ) {
    return false;
  }

  return true;
}

/**
 * The moment a vacancy became visible to everyone: when it went out, or, for
 * one a moderator let through later, when it was approved. A reopened vacancy
 * keeps its first date, so it is not news again.
 */
export function vacancyLiveSince(vacancy: {
  publishedAt: string | null;
  moderatedAt: string | null;
}): number | null {
  const published = vacancy.publishedAt ? Date.parse(vacancy.publishedAt) : Number.NaN;

  if (Number.isNaN(published)) {
    return null;
  }

  const moderated = vacancy.moderatedAt ? Date.parse(vacancy.moderatedAt) : Number.NaN;
  return Number.isNaN(moderated) ? published : Math.max(published, moderated);
}

// --- Errors --------------------------------------------------------------------------------

export type JobAlertWriteErrorCode = "duplicate" | "limit" | "invalid";

export function jobAlertWriteErrorCode(
  error: { code?: string | null; message?: string | null } | null,
): JobAlertWriteErrorCode | null {
  if (!error) {
    return null;
  }

  const message = error.message ?? "";

  if (message.includes("job_alert_limit_reached")) return "limit";
  if (error.code === "23505" || message.includes("saved_searches_vacancies_unique")) return "duplicate";

  return "invalid";
}
