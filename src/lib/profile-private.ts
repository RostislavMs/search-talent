import { salaryCurrencies, type SalaryCurrency } from "@/lib/profile-sections";

/**
 * Email, phone, salary expectations and the hourly rate live in
 * `profile_private_details`, which only the owner can read (see
 * database/2026-09-28-open-to.sql and 2026-09-29-hourly-rate.sql). Everyone
 * else gets email and phone through `open_profile_contacts()` after signing in,
 * and salary or the rate only when the owner turns it on.
 */
export const PROFILE_PRIVATE_DETAILS_COLUMNS =
  "contact_email, phone, salary_expectations, salary_currency, salary_public, hourly_rate, hourly_rate_currency, hourly_rate_public";

/** Bounds of `hourly_rate` (the table has the same check). */
export const HOURLY_RATE_MIN = 1;
export const HOURLY_RATE_MAX = 100_000;

export type ProfilePrivateDetailsRow = {
  contact_email: string | null;
  phone: string | null;
  salary_expectations: string | null;
  salary_currency: string | null;
  salary_public: boolean | null;
  hourly_rate?: number | null;
  hourly_rate_currency?: string | null;
  hourly_rate_public?: boolean | null;
};

export type ProfileContactSummary = {
  hasEmail: boolean;
  hasPhone: boolean;
  /** The values themselves: only for the owner (their own page and PDF). */
  email: string | null;
  phone: string | null;
};

export type PublicSalary = {
  amount: string;
  currency: SalaryCurrency | null;
};

/** "From `amount` per hour". */
export type PublicHourlyRate = {
  amount: number;
  currency: SalaryCurrency | null;
};

export function toSalaryCurrency(value: unknown): SalaryCurrency | null {
  return typeof value === "string" && salaryCurrencies.includes(value as SalaryCurrency)
    ? (value as SalaryCurrency)
    : null;
}

export function isValidHourlyRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= HOURLY_RATE_MIN &&
    value <= HOURLY_RATE_MAX
  );
}

/**
 * "from 20 USD per hour" / "від 20 USD за годину". `template` is
 * `openTo.hourlyRateValue` from the dictionary, with {amount} and {currency}.
 */
export function formatHourlyRate(
  rate: PublicHourlyRate,
  template: string,
  locale: string,
): string {
  const amount = new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US").format(rate.amount);

  return template
    .replace("{amount}", amount)
    .replace("{currency}", rate.currency ? rate.currency.toUpperCase() : "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** What a profile page may carry about the private details. */
export function summarizePrivateDetails(
  row: ProfilePrivateDetailsRow | null | undefined,
  { isOwner }: { isOwner: boolean },
): { contact: ProfileContactSummary; salary: PublicSalary | null; hourlyRate: PublicHourlyRate | null } {
  const email = row?.contact_email?.trim() || null;
  const phone = row?.phone?.trim() || null;
  const amount = row?.salary_expectations?.trim() || null;
  const rate = row?.hourly_rate;

  return {
    contact: {
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      email: isOwner ? email : null,
      phone: isOwner ? phone : null,
    },
    salary:
      amount && row?.salary_public
        ? { amount, currency: toSalaryCurrency(row.salary_currency) }
        : null,
    hourlyRate:
      isValidHourlyRate(rate) && row?.hourly_rate_public
        ? { amount: rate, currency: toSalaryCurrency(row.hourly_rate_currency) }
        : null,
  };
}
