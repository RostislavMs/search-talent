"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/Button";
import FormSelect from "@/components/ui/form-select";
import SearchSelect from "@/components/ui/search-select";
import TagSelect from "@/components/ui/tag-select";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import { createLocalePath } from "@/lib/i18n/config";
import { salaryCurrencies, type SalaryCurrency } from "@/lib/profile-sections";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";
import {
  VACANCY_HOURS,
  VACANCY_KINDS,
  VACANCY_LEVELS,
  VACANCY_LIMITS,
  VACANCY_LOCALES,
  VACANCY_PAY_PERIODS_BY_KIND,
  VACANCY_WORK_FORMATS,
  buildVacancyPath,
  defaultVacancyPayPeriod,
  isVacancyPayPeriodAllowed,
  isVacancyPayRequired,
  vacancyKindHasHours,
  type VacancyDetails,
  type VacancyHours,
  type VacancyKind,
  type VacancyLevel,
  type VacancyLocale,
  type VacancyPayPeriod,
  type VacancyWorkFormat,
} from "@/lib/vacancies";

const RichTextComposer = dynamic(() => import("@/components/rich-text-composer"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="min-h-[320px] animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]"
    />
  ),
});

/** A vacancy is a short document: headings and lists yes, video and rules no. */
const VACANCY_EDITOR_FEATURES = { divider: false } as const;

type Option = { id: number; name: string };

type FormState = {
  companyId: string;
  title: string;
  kind: VacancyKind;
  hours: VacancyHours | "";
  workFormats: VacancyWorkFormat[];
  countryId: number | null;
  city: string;
  level: VacancyLevel | "";
  categoryId: number | null;
  skillIds: number[];
  payMin: string;
  payMax: string;
  payCurrency: SalaryCurrency;
  payPeriod: VacancyPayPeriod;
  locale: VacancyLocale;
  description: string;
};

type FieldError =
  | "title"
  | "description"
  | "payMin"
  | "payMax"
  | "pay";

function toFormState(
  vacancy: VacancyDetails | null | undefined,
  companyId: string,
  locale: VacancyLocale,
): FormState {
  const kind = vacancy?.kind ?? "job";
  return {
    companyId: vacancy?.company.id ?? companyId,
    title: vacancy?.title ?? "",
    kind,
    hours: vacancy?.hours ?? "",
    workFormats: vacancy?.workFormats ?? [],
    countryId: vacancy?.countryId ?? null,
    city: vacancy?.city ?? "",
    level: vacancy?.experienceLevel ?? "",
    categoryId: vacancy?.categoryId ?? null,
    skillIds: vacancy?.skills.map((skill) => skill.id) ?? [],
    payMin: vacancy?.pay ? String(vacancy.pay.min) : "",
    payMax: vacancy?.pay && vacancy.pay.max !== vacancy.pay.min ? String(vacancy.pay.max) : "",
    payCurrency: vacancy?.pay?.currency ?? "uah",
    payPeriod: vacancy?.pay?.period ?? defaultVacancyPayPeriod(kind),
    locale: vacancy?.locale ?? locale,
    description: vacancy?.description ?? "",
  };
}

function sameState(a: FormState, b: FormState) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** "25 000" or "25000" → 25000; anything else → NaN; empty → null. */
function parseAmount(value: string): number | null {
  const digits = value.replace(/[\s ]/g, "");
  if (!digits) return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

function isAmount(value: number | null): value is number {
  return (
    value !== null &&
    Number.isInteger(value) &&
    value >= VACANCY_LIMITS.payMin &&
    value <= VACANCY_LIMITS.payMax
  );
}

const LABEL_CLASS = "mb-2 block text-sm font-medium text-[color:var(--foreground)]";
const HINT_CLASS = "mt-1.5 text-xs leading-5 app-soft";
const ERROR_CLASS = "mt-1.5 text-xs leading-5 text-rose-500";

/** Pill-shaped choices, one or many; the same look as the company type picker. */
function Chips<T extends string>({
  legend,
  name,
  options,
  selected,
  multiple = false,
  onToggle,
}: {
  legend: string;
  name: string;
  options: Array<{ value: T; label: string }>;
  selected: readonly T[];
  multiple?: boolean;
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className={LABEL_CLASS}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={[
                "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-[color:var(--ring)]",
                active
                  ? "border-transparent bg-[color:var(--foreground)] text-[color:var(--background)]"
                  : "app-border text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
              ].join(" ")}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onToggle(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/**
 * Write or edit a vacancy. A draft can be saved half-done; going out needs a
 * description and, for a job or an internship, the pay (owner's decision
 * 29.09). The database stamps the dates and decides moderation.
 */
export default function VacancyForm({
  vacancy,
  companies,
  defaultCompanyId,
  countries,
  categories,
  skills,
}: {
  /** The vacancy being edited; absent on the create form. */
  vacancy?: VacancyDetails | null;
  /** Pages the person may post for (their teams). */
  companies: Array<{ id: string; name: string; verified: boolean }>;
  defaultCompanyId?: string | null;
  countries: Option[];
  categories: Option[];
  skills: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const uiLocale = useCurrentLocale();
  const dictionary = useDictionary();
  const copy = dictionary.vacancies;
  const ui = copy.form;
  const fieldId = useId();
  const isEditing = Boolean(vacancy);
  const isDraft = !vacancy || vacancy.status === "draft";

  const initialCompany = defaultCompanyId ?? companies[0]?.id ?? "";
  const [saved, setSaved] = useState<FormState>(() => toFormState(vacancy, initialCompany, uiLocale));
  const [form, setForm] = useState<FormState>(() => toFormState(vacancy, initialCompany, uiLocale));
  const [errors, setErrors] = useState<Partial<Record<FieldError, string>>>({});
  const [saving, setSaving] = useState<"draft" | "published" | null>(null);

  const { isWarningOpen, confirmLeave, cancelLeave } = useUnsavedChangesGuard(
    !sameState(form, saved) && saving === null,
  );

  const company = companies.find((item) => item.id === form.companyId) ?? null;
  const payRequired = isVacancyPayRequired(form.kind);
  const periods = VACANCY_PAY_PERIODS_BY_KIND[form.kind];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Each kind is paid its own ways; keep the period one of them.
      if (key === "kind" && !isVacancyPayPeriodAllowed(next.kind, next.payPeriod)) {
        next.payPeriod = defaultVacancyPayPeriod(next.kind);
      }
      return next;
    });
    setErrors({});
  }

  function toggleFormat(format: VacancyWorkFormat) {
    update(
      "workFormats",
      form.workFormats.includes(format)
        ? form.workFormats.filter((item) => item !== format)
        : VACANCY_WORK_FORMATS.filter((item) => item === format || form.workFormats.includes(item)),
    );
  }

  function validate(status: "draft" | "published") {
    const next: Partial<Record<FieldError, string>> = {};
    const min = parseAmount(form.payMin);
    const max = parseAmount(form.payMax);

    if (form.title.trim().length < VACANCY_LIMITS.titleMin) {
      next.title = ui.errors.titleShort;
    }
    if (min !== null && !isAmount(min)) {
      next.payMin = ui.errors.payInvalid;
    }
    if (max !== null && (!isAmount(max) || (isAmount(min) && max < min))) {
      next.payMax = ui.errors.payRange;
    }
    if (max !== null && min === null) {
      next.payMin = ui.errors.payMinMissing;
    }
    if (status === "published") {
      if (extractPlainTextFromRichText(form.description).length < VACANCY_LIMITS.descriptionTextMin) {
        next.description = ui.errors.description_short;
      }
      if (payRequired && min === null) {
        next.pay = ui.errors.pay_required;
      }
    }
    return next;
  }

  function errorMessage(code: string | undefined, status: number): string {
    switch (code) {
      case "description_short":
      case "pay_required":
        return ui.errors[code];
      case "daily_limit":
        return ui.errors.dailyLimit.replace("{max}", String(VACANCY_LIMITS.perCompanyPerDay));
      case "skills_limit":
        return ui.errors.skillsLimit.replace("{max}", String(VACANCY_LIMITS.skillsMax));
      case "description_long":
        return ui.errors.descriptionLong;
      case "forbidden":
        return ui.errors.forbidden;
      case "email_unconfirmed":
        return ui.errors.emailUnconfirmed;
      case "invalid":
        return ui.errors.invalid;
      default:
        return status === 429 ? ui.errors.rateLimited : ui.errors.generic;
    }
  }

  async function submit(status: "draft" | "published") {
    if (saving) return;

    const nextErrors = validate(status);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0] ?? ui.errors.invalid);
      return;
    }

    const min = parseAmount(form.payMin);
    const max = parseAmount(form.payMax);
    const body = {
      ...(isEditing ? {} : { company_id: form.companyId }),
      title: form.title.trim(),
      description: form.description,
      kind: form.kind,
      hours: vacancyKindHasHours(form.kind) ? form.hours || null : null,
      work_formats: form.workFormats,
      country_id: form.countryId,
      city: form.city.trim() || null,
      experience_level: form.level || null,
      category_id: form.categoryId,
      pay: isAmount(min)
        ? { min, max: isAmount(max) ? max : null, currency: form.payCurrency, period: form.payPeriod }
        : null,
      locale: form.locale,
      skill_ids: form.skillIds,
      status,
    };

    setSaving(status);
    const result = await apiFetch<{
      vacancy: { id: string; slug: string };
      heldForReview?: boolean;
      moderationStatus?: string;
    }>(isEditing ? `/api/vacancies/${vacancy!.id}` : "/api/vacancies", {
      method: isEditing ? "PATCH" : "POST",
      body,
    });

    if (!result.ok) {
      setSaving(null);
      toast.error(errorMessage(result.code, result.status));
      return;
    }

    const { vacancy: savedVacancy, heldForReview, moderationStatus } = result.data;
    const wentOut = status === "published" || !isDraft;

    if (heldForReview) toast.warning(ui.heldForReview);
    else if (wentOut && moderationStatus === "under_review") toast.show(ui.sentForReview);
    else toast.success(status === "draft" && isDraft ? ui.draftSaved : wentOut && isDraft ? ui.published : ui.saved);

    // Clear the guard first, or it would intercept this navigation.
    setSaved(form);
    router.push(createLocalePath(uiLocale, buildVacancyPath(savedVacancy.slug)));
    router.refresh();
  }

  const kindOptions = VACANCY_KINDS.map((kind) => ({ value: kind, label: copy.kinds[kind] }));
  const hoursOptions = VACANCY_HOURS.map((hours) => ({ value: hours, label: copy.hours[hours] }));
  const formatOptions = VACANCY_WORK_FORMATS.map((format) => ({
    value: format,
    label: copy.formats[format],
  }));
  const levelOptions = VACANCY_LEVELS.map((level) => ({ value: level, label: copy.levels[level] }));
  const currencyOptions = salaryCurrencies.map((currency) => ({
    value: currency,
    label: currency.toUpperCase(),
  }));
  const periodOptions = periods.map((period) => ({ value: period, label: copy.payPeriods[period] }));
  const localeOptions = VACANCY_LOCALES.map((locale) => ({ value: locale, label: copy.languages[locale] }));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="order-2 min-w-0 space-y-6 xl:order-1">
          <section className="space-y-6 rounded-none app-card p-5 sm:rounded-hero sm:p-8">
            <Field>
              <label htmlFor={`${fieldId}-title`} className={LABEL_CLASS}>
                {ui.title}
              </label>
              <input
                id={`${fieldId}-title`}
                type="text"
                className="app-input"
                value={form.title}
                maxLength={VACANCY_LIMITS.titleMax}
                placeholder={ui.titlePlaceholder}
                aria-invalid={Boolean(errors.title)}
                onChange={(event) => update("title", event.target.value)}
              />
              {errors.title ? <p className={ERROR_CLASS}>{errors.title}</p> : null}
            </Field>

            <Chips
              legend={ui.kind}
              name={`${fieldId}-kind`}
              options={kindOptions}
              selected={[form.kind]}
              onToggle={(kind) => update("kind", kind)}
            />

            {vacancyKindHasHours(form.kind) ? (
              <Chips
                legend={ui.hours}
                name={`${fieldId}-hours`}
                options={hoursOptions}
                selected={form.hours ? [form.hours] : []}
                onToggle={(hours) => update("hours", form.hours === hours ? "" : hours)}
              />
            ) : null}

            <Chips
              legend={ui.formats}
              name={`${fieldId}-formats`}
              options={formatOptions}
              selected={form.workFormats}
              multiple
              onToggle={toggleFormat}
            />

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <p id={`${fieldId}-country-label`} className={LABEL_CLASS}>
                  {ui.country}
                </p>
                <div role="group" aria-labelledby={`${fieldId}-country-label`}>
                  <SearchSelect
                    options={countries}
                    value={form.countryId ?? undefined}
                    placeholder={ui.countryPlaceholder}
                    onChange={(value) => update("countryId", value)}
                  />
                </div>
              </Field>
              <Field>
                <label htmlFor={`${fieldId}-city`} className={LABEL_CLASS}>
                  {ui.city}
                </label>
                <input
                  id={`${fieldId}-city`}
                  type="text"
                  className="app-input"
                  value={form.city}
                  maxLength={VACANCY_LIMITS.cityMax}
                  autoComplete="address-level2"
                  onChange={(event) => update("city", event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field>
                <p id={`${fieldId}-level-label`} className={LABEL_CLASS}>
                  {ui.level}
                </p>
                <div role="group" aria-labelledby={`${fieldId}-level-label`}>
                  <FormSelect
                    options={levelOptions}
                    value={form.level}
                    placeholder={ui.notSpecified}
                    onChange={(value) => update("level", value as VacancyLevel | "")}
                  />
                </div>
              </Field>
              <Field>
                <p id={`${fieldId}-role-label`} className={LABEL_CLASS}>
                  {ui.role}
                </p>
                <div role="group" aria-labelledby={`${fieldId}-role-label`}>
                  <SearchSelect
                    options={categories}
                    value={form.categoryId ?? undefined}
                    placeholder={ui.rolePlaceholder}
                    onChange={(value) => update("categoryId", value)}
                  />
                </div>
              </Field>
            </div>

            <Field>
              <p id={`${fieldId}-skills-label`} className={LABEL_CLASS}>
                {ui.skills}
              </p>
              <div role="group" aria-labelledby={`${fieldId}-skills-label`}>
                <TagSelect
                  options={skills}
                  value={form.skillIds}
                  placeholder={ui.skillsPlaceholder}
                  onChange={(values) =>
                    update("skillIds", values.map(Number).slice(0, VACANCY_LIMITS.skillsMax))
                  }
                />
              </div>
              <p className={HINT_CLASS}>
                {ui.skillsHint.replace("{max}", String(VACANCY_LIMITS.skillsMax))}
              </p>
            </Field>

            <fieldset className="space-y-3 border-t app-border pt-6">
              <legend className={LABEL_CLASS}>{ui.pay}</legend>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_12rem]">
                <Field>
                  <label htmlFor={`${fieldId}-pay-min`} className="sr-only">
                    {ui.payFrom}
                  </label>
                  <input
                    id={`${fieldId}-pay-min`}
                    type="text"
                    inputMode="numeric"
                    className="app-input"
                    value={form.payMin}
                    placeholder={ui.payFrom}
                    aria-invalid={Boolean(errors.payMin || errors.pay)}
                    onChange={(event) => update("payMin", event.target.value)}
                  />
                </Field>
                <Field>
                  <label htmlFor={`${fieldId}-pay-max`} className="sr-only">
                    {ui.payTo}
                  </label>
                  <input
                    id={`${fieldId}-pay-max`}
                    type="text"
                    inputMode="numeric"
                    className="app-input"
                    value={form.payMax}
                    placeholder={ui.payTo}
                    aria-invalid={Boolean(errors.payMax)}
                    onChange={(event) => update("payMax", event.target.value)}
                  />
                </Field>
                <div role="group" aria-label={ui.payCurrency}>
                  <FormSelect
                    options={currencyOptions}
                    value={form.payCurrency}
                    onChange={(value) => update("payCurrency", value as SalaryCurrency)}
                  />
                </div>
                <div role="group" aria-label={ui.payPeriod}>
                  <FormSelect
                    options={periodOptions}
                    value={form.payPeriod}
                    onChange={(value) => update("payPeriod", value as VacancyPayPeriod)}
                  />
                </div>
              </div>
              {errors.pay || errors.payMin || errors.payMax ? (
                <p className={ERROR_CLASS}>{errors.pay ?? errors.payMin ?? errors.payMax}</p>
              ) : null}
              <p className={HINT_CLASS}>{payRequired ? ui.payRequiredHint : ui.payOptionalHint}</p>
            </fieldset>
          </section>

          <section className="rounded-none app-card p-5 sm:rounded-hero sm:p-8">
            <RichTextComposer
              locale={uiLocale}
              value={form.description}
              onChange={(value) => update("description", value)}
              label={ui.description}
              hint={ui.descriptionHint}
              placeholder={ui.descriptionPlaceholder}
              minHeight={360}
              maxLength={VACANCY_LIMITS.descriptionMax}
              features={VACANCY_EDITOR_FEATURES}
              contentClassName="min-h-[22rem] text-[15px] leading-8"
            />
            {errors.description ? <p className={ERROR_CLASS}>{errors.description}</p> : null}
          </section>
        </div>

        {/* Scrolls on its own once taller than the viewport — a sticky column
            without a height cap pins in place and hides its own overflow. */}
        <aside className="app-sticky-pane order-1 rounded-panel border app-border bg-[color:var(--surface)]/92 xl:order-2 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:self-start">
          <div className="space-y-5 p-5">
            <Field>
              <p className={LABEL_CLASS}>{ui.company}</p>
              {isEditing || companies.length <= 1 ? (
                <p className="text-sm text-[color:var(--foreground)]">
                  {vacancy?.company.name ?? company?.name ?? "—"}
                </p>
              ) : (
                <div role="group" aria-label={ui.company}>
                  <FormSelect
                    options={companies.map((item) => ({ value: item.id, label: item.name }))}
                    value={form.companyId}
                    onChange={(value) => update("companyId", value)}
                  />
                </div>
              )}
              {company && !company.verified && isDraft ? (
                <p className={HINT_CLASS}>{ui.unverifiedHint}</p>
              ) : null}
            </Field>

            <Field>
              <p className={LABEL_CLASS}>{ui.language}</p>
              <div role="group" aria-label={ui.language}>
                <FormSelect
                  options={localeOptions}
                  value={form.locale}
                  onChange={(value) => update("locale", value as VacancyLocale)}
                />
              </div>
              <p className={HINT_CLASS}>{ui.languageHint}</p>
            </Field>

            <div className="space-y-3 border-t app-border pt-5">
              <Button
                className="w-full"
                disabled={saving !== null || !form.companyId}
                onClick={() => void submit("published")}
              >
                {saving === "published" ? ui.saving : isDraft ? ui.publish : ui.save}
              </Button>
              {isDraft ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={saving !== null || !form.companyId}
                  onClick={() => void submit("draft")}
                >
                  {saving === "draft" ? ui.saving : ui.saveDraft}
                </Button>
              ) : null}
              <p className="text-xs leading-5 app-soft">
                {isDraft
                  ? ui.publishNote.replace("{days}", String(VACANCY_LIMITS.openDays))
                  : ui.editNote}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={isWarningOpen}
        title={dictionary.common.unsavedChangesTitle}
        description={dictionary.common.unsavedChangesDescription}
        confirmLabel={dictionary.common.unsavedChangesLeave}
        cancelLabel={dictionary.common.unsavedChangesStay}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}
