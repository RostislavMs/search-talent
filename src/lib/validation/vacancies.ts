import { z } from "zod";
import { salaryCurrencies } from "@/lib/profile-sections";
import { extractPlainTextFromRichText } from "@/lib/rich-text-plain";
import {
  VACANCY_HOURS,
  VACANCY_KINDS,
  VACANCY_LEVELS,
  VACANCY_LIMITS,
  VACANCY_LOCALES,
  VACANCY_PAY_PERIODS,
  VACANCY_WORK_FORMATS,
  isVacancyPayPeriodAllowed,
  isVacancyPayRequired,
  vacancyKindHasHours,
  type VacancyKind,
  type VacancyPay,
} from "@/lib/vacancies";

const uuidMessage = "Invalid identifier";

const looseString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

function optionalText(max: number, label: string) {
  return looseString
    .refine((value) => value.length <= max, { message: `${label} is too long` })
    .transform((value) => value || null);
}

const optionalId = z
  .union([z.number().int().positive(), z.null(), z.undefined()])
  .transform((value) => value ?? null);

function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .union([z.enum(values), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? (value as T[number]) : null));
}

const payAmount = z
  .number()
  .int("Pay must be a whole number")
  .min(VACANCY_LIMITS.payMin, "Pay is too small")
  .max(VACANCY_LIMITS.payMax, "Pay is too large");

/** An amount, or a range when `max` is given; a fixed amount has max = min. */
const paySchema = z
  .object({
    min: payAmount,
    max: z.union([payAmount, z.null(), z.undefined()]).transform((value) => value ?? null),
    currency: z.enum(salaryCurrencies),
    period: z.enum(VACANCY_PAY_PERIODS),
  })
  .refine((pay) => pay.max === null || pay.max >= pay.min, {
    message: "The upper end is below the lower one",
    path: ["max"],
  })
  .transform((pay): VacancyPay => ({ ...pay, max: pay.max ?? pay.min }));

/**
 * What the create/edit form sends. `status` says what the author asked for:
 * keep a draft or have it out. The routes decide what that means for a
 * vacancy that is already out (its status changes only through
 * /api/vacancies/:id/status).
 */
export const vacancyPayloadSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(VACANCY_LIMITS.titleMin, "Title is too short")
      .max(VACANCY_LIMITS.titleMax, "Title is too long"),
    // Raw editor HTML; the route sanitizes it and checks the stored length.
    description: z
      .string()
      .max(VACANCY_LIMITS.descriptionMax, "Description is too long")
      .default(""),
    kind: z.enum(VACANCY_KINDS),
    hours: optionalEnum(VACANCY_HOURS),
    work_formats: z
      .array(z.enum(VACANCY_WORK_FORMATS))
      .default([])
      .transform((values) => VACANCY_WORK_FORMATS.filter((format) => values.includes(format))),
    country_id: optionalId,
    city: optionalText(VACANCY_LIMITS.cityMax, "City"),
    experience_level: optionalEnum(VACANCY_LEVELS),
    category_id: optionalId,
    // .nullish() rather than a union: a union reports only "Invalid input" and
    // the reason (too small, upside down) would be lost.
    pay: paySchema.nullish().transform((value) => value ?? null),
    locale: z.enum(VACANCY_LOCALES).default("uk"),
    skill_ids: z
      .array(z.number().int().positive())
      .max(VACANCY_LIMITS.skillsMax, "Too many skills")
      .default([])
      .transform((values) => [...new Set(values)]),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .refine((value) => !value.pay || isVacancyPayPeriodAllowed(value.kind, value.pay.period), {
    message: "This kind of vacancy is not paid that way",
    path: ["pay", "period"],
  })
  // Full or part time is about employment; freelance has neither.
  .transform((value) => ({
    ...value,
    hours: vacancyKindHasHours(value.kind) ? value.hours : null,
  }));

export type VacancyPayload = z.infer<typeof vacancyPayloadSchema>;

export const createVacancySchema = z.intersection(
  z.object({ company_id: z.string().uuid(uuidMessage) }),
  vacancyPayloadSchema,
);

export type VacancyReadinessIssue = "description_short" | "pay_required";

/**
 * What still keeps a vacancy from going out: enough text to say what the work
 * is, and pay for a job or an internship (owner's decision 29.09). A draft may
 * be saved without them.
 */
export function vacancyReadinessIssues(vacancy: {
  kind: VacancyKind;
  description: string;
  pay: VacancyPay | null;
}): VacancyReadinessIssue[] {
  const issues: VacancyReadinessIssue[] = [];

  if (extractPlainTextFromRichText(vacancy.description).length < VACANCY_LIMITS.descriptionTextMin) {
    issues.push("description_short");
  }

  if (isVacancyPayRequired(vacancy.kind) && !vacancy.pay) {
    issues.push("pay_required");
  }

  return issues;
}

export const routeVacancyIdSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

/**
 * publish: a draft goes out. close: the team takes it down. extend: open for
 * 60 days from now — for an open vacancy near its end, an expired one, or a
 * closed one being reopened alike.
 */
export const VACANCY_STATUS_ACTIONS = ["publish", "close", "extend"] as const;
export type VacancyStatusAction = (typeof VACANCY_STATUS_ACTIONS)[number];

export const vacancyStatusActionSchema = z.object({
  action: z.enum(VACANCY_STATUS_ACTIONS),
});
