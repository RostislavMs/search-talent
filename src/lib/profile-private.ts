import { salaryCurrencies, type SalaryCurrency } from "@/lib/profile-sections";

/**
 * Email, phone and salary expectations live in `profile_private_details`,
 * which only the owner can read (see database/2026-09-28-open-to.sql).
 * Everyone else gets email and phone through `open_profile_contacts()` after
 * signing in, and salary only when the owner turns it on.
 */
export const PROFILE_PRIVATE_DETAILS_COLUMNS =
  "contact_email, phone, salary_expectations, salary_currency, salary_public";

export type ProfilePrivateDetailsRow = {
  contact_email: string | null;
  phone: string | null;
  salary_expectations: string | null;
  salary_currency: string | null;
  salary_public: boolean | null;
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

function toSalaryCurrency(value: unknown): SalaryCurrency | null {
  return typeof value === "string" && salaryCurrencies.includes(value as SalaryCurrency)
    ? (value as SalaryCurrency)
    : null;
}

/** What a profile page may carry about the private details. */
export function summarizePrivateDetails(
  row: ProfilePrivateDetailsRow | null | undefined,
  { isOwner }: { isOwner: boolean },
): { contact: ProfileContactSummary; salary: PublicSalary | null } {
  const email = row?.contact_email?.trim() || null;
  const phone = row?.phone?.trim() || null;
  const amount = row?.salary_expectations?.trim() || null;

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
  };
}
