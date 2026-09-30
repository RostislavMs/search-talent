/**
 * «Відкрито до…» (open to): what kind of offers a person wants to hear about.
 *
 * A status on the person's own portfolio. Companies (hiring stage 8.1, see
 * src/lib/companies.ts) reach people through it and the «Зв'язатися» button;
 * vacancies will use the same dictionary for their kind. The status lives in
 * `profiles.open_to` (public), and the moment
 * it was last set or confirmed in `profiles.open_to_updated_at`, which the
 * database stamps with its own clock (see database/2026-09-28-open-to.sql).
 */

export const openToOptions = [
  "freelance",
  "job",
  "internship",
  "collaboration",
  "mentoring",
] as const;

export type OpenToOption = (typeof openToOptions)[number];

/** After this many days without a change the owner is asked if it still holds. */
export const OPEN_TO_REMINDER_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isOpenToOption(value: unknown): value is OpenToOption {
  return typeof value === "string" && openToOptions.includes(value as OpenToOption);
}

/** Known values only, each once, in the canonical order above. */
export function normalizeOpenTo(value: unknown): OpenToOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return openToOptions.filter((option) => value.includes(option));
}

// The "employment types" field that «Відкрито до…» replaces. Kept only to read
// saved searches and old links; the migration moves stored profiles over.
const LEGACY_EMPLOYMENT_TYPE_TO_OPEN_TO: Record<string, OpenToOption> = {
  freelance: "freelance",
  internship: "internship",
  full_time: "job",
  part_time: "job",
  contract: "job",
};

export function openToFromEmploymentTypes(value: unknown): OpenToOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeOpenTo(
    value
      .map((item) => (typeof item === "string" ? LEGACY_EMPLOYMENT_TYPE_TO_OPEN_TO[item] : undefined))
      .filter(Boolean),
  );
}

/**
 * True when the status is on and was last confirmed at least
 * OPEN_TO_REMINDER_DAYS ago. A status without a date (set before the date was
 * recorded) counts as old, so its owner gets asked once.
 */
export function isOpenToStale(
  openTo: readonly string[],
  updatedAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (openTo.length === 0) {
    return false;
  }

  const time = updatedAt ? new Date(updatedAt).getTime() : Number.NaN;

  if (Number.isNaN(time)) {
    return true;
  }

  return now - time >= OPEN_TO_REMINDER_DAYS * DAY_MS;
}

/**
 * "фрилансу, стажування" for «Відкрито до: …». `phrases` holds each option in
 * the form that follows «до» / "open to" (see `openTo.phrases` in the
 * dictionary).
 */
export function formatOpenToList(
  openTo: readonly string[],
  phrases: Record<OpenToOption, string>,
): string {
  return normalizeOpenTo(openTo)
    .map((option) => phrases[option])
    .join(", ");
}
