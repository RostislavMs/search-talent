"use client";

import CompanyPicker, { type CompanyOption } from "@/components/company-picker";
import FormSelect from "@/components/ui/form-select";
import { COMPANY_LIMITS } from "@/lib/companies";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { salaryCurrencies, type SalaryCurrency } from "@/lib/profile-sections";
import {
  originHasBudget,
  originHasClient,
  PROJECT_BUDGET_TYPES,
  PROJECT_CONTEXT_LIMITS,
  PROJECT_ORIGINS,
  type ProjectBudgetType,
  type ProjectOrigin,
} from "@/lib/project-context";
import { Field } from "./shared";

export type ProjectContextValue = {
  origin: ProjectOrigin | "";
  clientName: string;
  clientNda: boolean;
  budgetAmount: string;
  budgetCurrency: SalaryCurrency;
  budgetType: ProjectBudgetType;
  budgetPublic: boolean;
};

/**
 * "For whom and for how much" on the details step: what the project was made
 * for, the client or the company (with an NDA switch), company pages to show
 * it on, and — for client work — the budget, hidden unless switched on.
 * Fields that do not fit the chosen origin are hidden and not sent.
 */
export default function ProjectContextFields({
  dictionary,
  value,
  onChange,
  companies,
  onCompaniesChange,
}: {
  dictionary: Dictionary;
  value: ProjectContextValue;
  onChange: <K extends keyof ProjectContextValue>(field: K, next: ProjectContextValue[K]) => void;
  companies: CompanyOption[];
  onCompaniesChange: (next: CompanyOption[]) => void;
}) {
  const ui = dictionary.projectContext;
  const origin = value.origin || null;
  const withClient = originHasClient(origin);
  const withBudget = originHasBudget(origin);

  return (
    <div className="rounded-2xl app-card p-5">
      <h3 className="font-display text-base font-semibold text-[color:var(--foreground)]">
        {ui.title}
      </h3>
      <p className="mb-4 mt-1 text-sm app-muted">{ui.description}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={ui.origin} htmlFor="project-origin">
          <FormSelect
            name="project-origin"
            className="w-full"
            triggerClassName="w-full"
            placeholder={ui.originNone}
            value={value.origin}
            onChange={(next) => onChange("origin", next as ProjectOrigin | "")}
            options={PROJECT_ORIGINS.map((item) => ({ value: item, label: ui.origins[item] }))}
          />
        </Field>

        {withClient && !value.clientNda ? (
          <Field
            label={origin === "job" ? ui.companyLabel : ui.clientLabel}
            htmlFor="project-client-name"
          >
            <input
              id="project-client-name"
              type="text"
              className="app-input"
              value={value.clientName}
              maxLength={PROJECT_CONTEXT_LIMITS.clientNameMax}
              placeholder={ui.clientPlaceholder}
              onChange={(event) => onChange("clientName", event.target.value)}
            />
          </Field>
        ) : null}

        {withClient ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-[color:var(--foreground)] md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
              checked={value.clientNda}
              onChange={(event) => onChange("clientNda", event.target.checked)}
            />
            <span>
              {ui.nda}
              <span className="block text-xs app-muted">{ui.ndaHint}</span>
            </span>
          </label>
        ) : null}

        {/* Company pages do not depend on the origin: a team member may show any
            of their projects on the company page. */}
        <div className="md:col-span-2">
          <p className="mb-2 block text-sm font-medium text-[color:var(--foreground)]">
            {ui.companies}
          </p>
          <p className="-mt-1 mb-2 text-xs app-muted">{ui.companiesHint}</p>
          <CompanyPicker
            value={companies}
            onChange={onCompaniesChange}
            max={COMPANY_LIMITS.companiesPerProject}
            labels={{
              input: ui.companies,
              placeholder: ui.companiesSearch,
              searching: ui.searching,
              noResults: ui.noResults,
              limitReached: ui.companiesLimit.replace(
                "{max}",
                String(COMPANY_LIMITS.companiesPerProject),
              ),
              remove: ui.removeCompany,
              statusShown: ui.statusShown,
              statusPending: ui.statusPending,
              statusConfirmed: ui.statusConfirmed,
            }}
          />
        </div>

        {withBudget ? (
          <fieldset className="rounded-2xl border app-border p-4 md:col-span-2">
            <legend className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
              {ui.budget}
            </legend>
            <p className="mb-3 text-xs app-muted">{ui.budgetHint}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={ui.budgetAmount} htmlFor="project-budget-amount">
                <input
                  id="project-budget-amount"
                  type="number"
                  inputMode="numeric"
                  min={PROJECT_CONTEXT_LIMITS.budgetMin}
                  max={PROJECT_CONTEXT_LIMITS.budgetMax}
                  step={1}
                  className="app-input"
                  value={value.budgetAmount}
                  onChange={(event) =>
                    onChange("budgetAmount", event.target.value.replace(/[^\d]/g, ""))
                  }
                />
              </Field>
              <Field label={ui.budgetCurrency} htmlFor="project-budget-currency">
                <FormSelect
                  name="project-budget-currency"
                  className="w-full"
                  triggerClassName="w-full"
                  value={value.budgetCurrency}
                  onChange={(next) => onChange("budgetCurrency", next as SalaryCurrency)}
                  options={salaryCurrencies.map((currency) => ({
                    value: currency,
                    label: currency.toUpperCase(),
                  }))}
                />
              </Field>
              <Field label={ui.budgetType} htmlFor="project-budget-type">
                <FormSelect
                  name="project-budget-type"
                  className="w-full"
                  triggerClassName="w-full"
                  value={value.budgetType}
                  onChange={(next) => onChange("budgetType", next as ProjectBudgetType)}
                  options={PROJECT_BUDGET_TYPES.map((type) => ({
                    value: type,
                    label: ui.budgetTypes[type],
                  }))}
                />
              </Field>
            </div>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-[color:var(--foreground)]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[color:var(--accent)]"
                checked={value.budgetPublic}
                disabled={!value.budgetAmount}
                onChange={(event) => onChange("budgetPublic", event.target.checked)}
              />
              <span>{ui.budgetPublic}</span>
            </label>
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}
