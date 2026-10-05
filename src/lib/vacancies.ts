// Vacancies (hiring stage 8.2, docs/hiring.md). Pure helpers shared by the
// API, the pages and the tests; the rules they mirror live in
// database/2026-09-30-vacancies.sql, which stays the authority.

import type { OpenToOption } from "@/lib/open-to";
import {
  salaryCurrencies,
  workFormats,
  type SalaryCurrency,
  type WorkFormat,
} from "@/lib/profile-sections";
import { slugify } from "@/lib/slug";

/** The same words as "Open to", without mentoring: nobody posts a mentor. */
export const VACANCY_KINDS = [
  "job",
  "internship",
  "freelance",
  "collaboration",
] as const satisfies readonly OpenToOption[];
export type VacancyKind = (typeof VACANCY_KINDS)[number];

export const VACANCY_HOURS = ["full_time", "part_time"] as const;
export type VacancyHours = (typeof VACANCY_HOURS)[number];

export const VACANCY_WORK_FORMATS = workFormats;
export type VacancyWorkFormat = WorkFormat;

export const VACANCY_LEVELS = ["no_experience", "junior", "middle", "senior", "lead"] as const;
export type VacancyLevel = (typeof VACANCY_LEVELS)[number];

export const VACANCY_PAY_PERIODS = ["hour", "month", "project"] as const;
export type VacancyPayPeriod = (typeof VACANCY_PAY_PERIODS)[number];

export const VACANCY_STATUSES = ["draft", "published", "closed", "expired"] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];

export const VACANCY_LOCALES = ["uk", "en"] as const;
export type VacancyLocale = (typeof VACANCY_LOCALES)[number];

export const VACANCY_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  /** Stored HTML (vacancies_description_check). */
  descriptionMax: 20_000,
  /** Plain text a vacancy needs before it goes out. */
  descriptionTextMin: 80,
  cityMax: 80,
  /** limit_vacancy_skills() */
  skillsMax: 15,
  payMin: 1,
  payMax: 100_000_000,
  /** How long a vacancy stays open after going out (guard_vacancy_columns). */
  openDays: 60,
  /** New vacancies a company may create a day (guard_vacancy_columns). */
  perCompanyPerDay: 5,
} as const;

/** A job or an internship is paid monthly or hourly; freelance hourly or per project. */
export const VACANCY_PAY_PERIODS_BY_KIND: Record<VacancyKind, readonly VacancyPayPeriod[]> = {
  job: ["month", "hour"],
  internship: ["month", "hour"],
  freelance: ["hour", "project"],
  collaboration: ["month", "hour", "project"],
};

/** Owner's decision 29.09: a job or an internship always shows its pay. */
export function isVacancyPayRequired(kind: VacancyKind): boolean {
  return kind === "job" || kind === "internship";
}

/** Full or part time only means something for employment. */
export function vacancyKindHasHours(kind: VacancyKind): boolean {
  return kind === "job" || kind === "internship";
}

export function isVacancyPayPeriodAllowed(kind: VacancyKind, period: VacancyPayPeriod): boolean {
  return VACANCY_PAY_PERIODS_BY_KIND[kind].includes(period);
}

export function defaultVacancyPayPeriod(kind: VacancyKind): VacancyPayPeriod {
  return VACANCY_PAY_PERIODS_BY_KIND[kind][0];
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export function normalizeVacancyKind(value: unknown): VacancyKind {
  return isOneOf(VACANCY_KINDS, value) ? value : "job";
}

export function normalizeVacancyHours(value: unknown): VacancyHours | null {
  return isOneOf(VACANCY_HOURS, value) ? value : null;
}

export function normalizeVacancyLevel(value: unknown): VacancyLevel | null {
  return isOneOf(VACANCY_LEVELS, value) ? value : null;
}

export function normalizeVacancyStatus(value: unknown): VacancyStatus {
  return isOneOf(VACANCY_STATUSES, value) ? value : "draft";
}

export function normalizeVacancyLocale(value: unknown): VacancyLocale {
  return value === "en" ? "en" : "uk";
}

/** Known values only, each once, in the canonical order. */
export function normalizeVacancyWorkFormats(value: unknown): VacancyWorkFormat[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return VACANCY_WORK_FORMATS.filter((format) => value.includes(format));
}

// --- Pay ---------------------------------------------------------------------------

/** An amount (min = max) or a range, in one currency, for one period. */
export type VacancyPay = {
  min: number;
  max: number;
  currency: SalaryCurrency;
  period: VacancyPayPeriod;
};

function isPayAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= VACANCY_LIMITS.payMin &&
    value <= VACANCY_LIMITS.payMax
  );
}

export function toVacancyPay(row: {
  pay_min?: unknown;
  pay_max?: unknown;
  pay_currency?: unknown;
  pay_period?: unknown;
}): VacancyPay | null {
  const { pay_min: min, pay_max: max, pay_currency: currency, pay_period: period } = row;

  if (
    !isPayAmount(min) ||
    !isPayAmount(max) ||
    max < min ||
    !isOneOf(salaryCurrencies, currency) ||
    !isOneOf(VACANCY_PAY_PERIODS, period)
  ) {
    return null;
  }

  return { min, max, currency, period };
}

/**
 * "20 000–30 000 UAH на місяць", "15 USD за годину", "8 000 UAH за проєкт".
 * `templates` come from the dictionary (vacancies.pay), with {amount} and
 * {currency}.
 */
export function formatVacancyPay(
  pay: VacancyPay,
  templates: Record<VacancyPayPeriod, string>,
  locale: string,
): string {
  const format = new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US");
  const amount =
    pay.min === pay.max ? format.format(pay.min) : `${format.format(pay.min)}–${format.format(pay.max)}`;

  return templates[pay.period]
    .replace("{amount}", amount)
    .replace("{currency}", pay.currency.toUpperCase());
}

// --- Life cycle ------------------------------------------------------------------------

/**
 * What a vacancy is right now. A published one whose 60 days ran out is
 * expired even before the daily cron marks it.
 */
export type VacancyState = "draft" | "open" | "closed" | "expired";

export function resolveVacancyState(
  vacancy: { status: VacancyStatus; expiresAt: string | null },
  now: number = Date.now(),
): VacancyState {
  switch (vacancy.status) {
    case "draft":
      return "draft";
    case "closed":
      return "closed";
    case "expired":
      return "expired";
    default: {
      const expires = vacancy.expiresAt ? new Date(vacancy.expiresAt).getTime() : Number.NaN;
      return Number.isNaN(expires) || expires > now ? "open" : "expired";
    }
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left, 0 on the last day; null when it is not open. */
export function daysUntilVacancyExpires(
  expiresAt: string | null,
  now: number = Date.now(),
): number | null {
  const expires = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
  if (Number.isNaN(expires) || expires <= now) {
    return null;
  }
  return Math.floor((expires - now) / DAY_MS);
}

/** "Extend" is offered in the last week, and on anything that ran out or was closed. */
export const VACANCY_EXTEND_WINDOW_DAYS = 7;

export function canExtendVacancy(
  vacancy: { status: VacancyStatus; expiresAt: string | null },
  now: number = Date.now(),
): boolean {
  const state = resolveVacancyState(vacancy, now);
  if (state === "expired" || state === "closed") {
    return true;
  }
  if (state !== "open") {
    return false;
  }
  const left = daysUntilVacancyExpires(vacancy.expiresAt, now);
  return left !== null && left < VACANCY_EXTEND_WINDOW_DAYS;
}

/**
 * A vacancy belongs in search engines only while it is open, approved, and
 * posted by a verified, visible company: an unverified page is anyone's claim,
 * and Google penalises job markup that outlives the job.
 */
export function isVacancyIndexable(vacancy: {
  state: VacancyState;
  moderationStatus: string;
  company: { verified: boolean; moderationStatus: string };
}): boolean {
  return (
    vacancy.state === "open" &&
    vacancy.moderationStatus === "approved" &&
    vacancy.company.moderationStatus === "approved" &&
    vacancy.company.verified
  );
}

/**
 * schema.org employmentType values for JobPosting. Google reads FULL_TIME,
 * PART_TIME, CONTRACTOR, INTERN and OTHER.
 */
export function vacancyEmploymentTypes(kind: VacancyKind, hours: VacancyHours | null): string[] {
  const time = hours === "part_time" ? "PART_TIME" : hours === "full_time" ? "FULL_TIME" : null;

  switch (kind) {
    case "job":
      return [time ?? "FULL_TIME"];
    case "internship":
      return time ? ["INTERN", time] : ["INTERN"];
    case "freelance":
      return ["CONTRACTOR"];
    default:
      return ["OTHER"];
  }
}

// --- Addresses ---------------------------------------------------------------------------

export const JOBS_PATH = "/jobs";

/** Routes that live under /jobs/ and so cannot be a vacancy's address. */
export const RESERVED_VACANCY_SLUGS = ["new", "edit"] as const;

const VACANCY_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_TITLE_MAX = 80;

export function buildVacancyPath(slug: string): string {
  return `${JOBS_PATH}/${slug}`;
}

export function isValidVacancySlug(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 100 &&
    VACANCY_SLUG_PATTERN.test(value) &&
    !(RESERVED_VACANCY_SLUGS as readonly string[]).includes(value)
  );
}

/** Six random base-36 characters: two vacancies with one title get two addresses. */
export function randomVacancySlugSuffix(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}

/**
 * "Junior frontend-розробник" → "junior-frontend-rozrobnyk-k3x9q2". Made once,
 * when the vacancy is created, and never changed: links and search results
 * keep working after the title is edited.
 */
export function buildVacancySlug(title: string, suffix: string = randomVacancySlugSuffix()): string {
  const base = slugify(title, "vacancy").slice(0, SLUG_TITLE_MAX).replace(/-+$/g, "") || "vacancy";
  return `${base}-${suffix}`;
}

// --- The public list ---------------------------------------------------------------------

export const JOBS_PAGE_SIZE = 20;

export type VacancyFilters = {
  kind: VacancyKind | null;
  format: VacancyWorkFormat | null;
  level: VacancyLevel | null;
  countryId: number | null;
  categoryId: number | null;
  skillId: number | null;
  /** Only vacancies that show their pay. */
  paid: boolean;
  q: string;
  page: number;
};

export const EMPTY_VACANCY_FILTERS: VacancyFilters = {
  kind: null,
  format: null,
  level: null,
  countryId: null,
  categoryId: null,
  skillId: null,
  paid: false,
  q: "",
  page: 1,
};

type SearchParamsLike = Record<string, string | string[] | undefined>;

function firstParam(params: SearchParamsLike, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function positiveInt(value: string): number | null {
  if (!/^\d{1,9}$/.test(value)) {
    return null;
  }
  const number = Number(value);
  return number > 0 ? number : null;
}

/** Reads /jobs?kind=internship&format=remote&page=2; anything unknown is dropped. */
export function parseVacancyFilters(params: SearchParamsLike): VacancyFilters {
  const kind = firstParam(params, "kind");
  const format = firstParam(params, "format");
  const level = firstParam(params, "level");

  return {
    kind: isOneOf(VACANCY_KINDS, kind) ? kind : null,
    format: isOneOf(VACANCY_WORK_FORMATS, format) ? format : null,
    level: isOneOf(VACANCY_LEVELS, level) ? level : null,
    countryId: positiveInt(firstParam(params, "country")),
    categoryId: positiveInt(firstParam(params, "role")),
    skillId: positiveInt(firstParam(params, "skill")),
    paid: firstParam(params, "paid") === "1",
    q: firstParam(params, "q").slice(0, 80),
    page: Math.min(positiveInt(firstParam(params, "page")) ?? 1, 500),
  };
}

/** Whether anything narrows the list (the page number does not). */
export function hasVacancyFilters(filters: VacancyFilters): boolean {
  return Boolean(
    filters.kind ||
      filters.format ||
      filters.level ||
      filters.countryId ||
      filters.categoryId ||
      filters.skillId ||
      filters.paid ||
      filters.q,
  );
}

/** The /jobs address for a set of filters, without empty parameters. */
export function buildJobsHref(filters: Partial<VacancyFilters>): string {
  const params = new URLSearchParams();
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.format) params.set("format", filters.format);
  if (filters.level) params.set("level", filters.level);
  if (filters.countryId) params.set("country", String(filters.countryId));
  if (filters.categoryId) params.set("role", String(filters.categoryId));
  if (filters.skillId) params.set("skill", String(filters.skillId));
  if (filters.paid) params.set("paid", "1");
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `${JOBS_PATH}?${query}` : JOBS_PATH;
}

// --- Shapes the pages work with ------------------------------------------------------------

export type VacancyCompany = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  moderationStatus: string;
};

export type VacancySummary = {
  id: string;
  slug: string;
  title: string;
  kind: VacancyKind;
  hours: VacancyHours | null;
  workFormats: VacancyWorkFormat[];
  city: string | null;
  countryName: string | null;
  experienceLevel: VacancyLevel | null;
  categoryName: string | null;
  pay: VacancyPay | null;
  locale: VacancyLocale;
  status: VacancyStatus;
  state: VacancyState;
  moderationStatus: string;
  publishedAt: string | null;
  expiresAt: string | null;
  company: VacancyCompany;
};

export type VacancyDetails = VacancySummary & {
  description: string;
  countryId: number | null;
  categoryId: number | null;
  skills: Array<{ id: number; name: string }>;
  authorUserId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** "Київ, Україна" / "Remote" — the place, or nothing. */
export function formatVacancyPlace(
  city: string | null | undefined,
  countryName: string | null | undefined,
): string | null {
  const parts = [city?.trim(), countryName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// Moved to `@/lib/plural` (scores use it too); re-exported for existing callers.
export { formatCount, type CountForms } from "@/lib/plural";

// --- Write errors --------------------------------------------------------------------------

export type VacancyWriteErrorCode =
  | "daily_limit"
  | "invalid_status"
  | "pay_required"
  | "skills_limit"
  | "forbidden"
  | "invalid";

/** Turns a failed insert/update into the reason the form shows. */
export function vacancyWriteErrorCode(
  error: { code?: string | null; message?: string | null } | null,
): VacancyWriteErrorCode | null {
  if (!error) {
    return null;
  }

  const message = error.message ?? "";

  if (message.includes("vacancy_daily_limit_reached")) return "daily_limit";
  if (message.includes("invalid_vacancy_status")) return "invalid_status";
  if (message.includes("vacancies_pay_required_check")) return "pay_required";
  if (message.includes("vacancy_skills_limit_reached")) return "skills_limit";
  // The insert policy: not in the team, the page is hidden, or the email is
  // not confirmed.
  if (error.code === "42501") return "forbidden";

  return "invalid";
}
