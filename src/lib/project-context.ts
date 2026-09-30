// What a project was made for, for whom and for how much (hiring 8.1,
// database/2026-09-30-companies.sql, section 7a). Pure: shared by the form,
// the API and the project page.

import { salaryCurrencies, type SalaryCurrency } from "@/lib/profile-sections";

export const PROJECT_ORIGINS = ["personal", "client", "job", "study", "open_source"] as const;
export type ProjectOrigin = (typeof PROJECT_ORIGINS)[number];

export const PROJECT_BUDGET_TYPES = ["fixed", "hourly"] as const;
export type ProjectBudgetType = (typeof PROJECT_BUDGET_TYPES)[number];

export const PROJECT_CONTEXT_LIMITS = {
  clientNameMax: 120,
  budgetMin: 1,
  budgetMax: 100_000_000,
} as const;

export type ProjectBudget = {
  amount: number;
  currency: SalaryCurrency;
  type: ProjectBudgetType;
};

/** The budget as its author edits it: with the "show on the page" switch. */
export type EditorProjectBudget = ProjectBudget & { isPublic: boolean };

export function normalizeProjectOrigin(value: unknown): ProjectOrigin | null {
  return typeof value === "string" && (PROJECT_ORIGINS as readonly string[]).includes(value)
    ? (value as ProjectOrigin)
    : null;
}

/** Only a client's project or one done at a job has a client or a company. */
export function originHasClient(origin: ProjectOrigin | null | undefined): boolean {
  return origin === "client" || origin === "job";
}

/** A budget is about freelance work: what the client paid. */
export function originHasBudget(origin: ProjectOrigin | null | undefined): boolean {
  return origin === "client";
}

export function toProjectBudget(row: {
  amount?: unknown;
  currency?: unknown;
  type?: unknown;
} | null | undefined): ProjectBudget | null {
  if (!row) return null;

  const amount = row.amount;
  const currency = row.currency;
  const type = row.type;

  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < PROJECT_CONTEXT_LIMITS.budgetMin ||
    amount > PROJECT_CONTEXT_LIMITS.budgetMax ||
    typeof currency !== "string" ||
    !salaryCurrencies.includes(currency as SalaryCurrency) ||
    typeof type !== "string" ||
    !(PROJECT_BUDGET_TYPES as readonly string[]).includes(type)
  ) {
    return null;
  }

  return { amount, currency: currency as SalaryCurrency, type: type as ProjectBudgetType };
}

/**
 * "8 000 UAH" for a fixed budget, "20 USD per hour" for an hourly one.
 * `templates` come from the dictionary (projectContext.budgetFixed/Hourly).
 */
export function formatProjectBudget(
  budget: ProjectBudget,
  templates: { fixed: string; hourly: string },
  locale: string,
): string {
  const amount = new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "en-US").format(budget.amount);
  return templates[budget.type]
    .replace("{amount}", amount)
    .replace("{currency}", budget.currency.toUpperCase());
}

/**
 * What the page says about the client: the name, or that it is under NDA.
 * Null when there is nothing to say.
 */
export function describeProjectClient(
  project: { origin: ProjectOrigin | null; clientName: string | null; clientNda: boolean },
  ndaLabel: string,
): string | null {
  if (!originHasClient(project.origin)) {
    return null;
  }

  if (project.clientNda) {
    return ndaLabel;
  }

  return project.clientName?.trim() || null;
}
