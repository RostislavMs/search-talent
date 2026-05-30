import { z } from "zod";
import {
  createDefaultProfileVisibility,
  employmentTypes,
  experienceLevels,
  languageLevels,
  preferredContactMethods,
  salaryCurrencies,
  workFormats,
} from "@/lib/profile-sections";
import { normalizeProfileSettings } from "@/lib/profile-presentation";
import { isValidPublicUrl } from "@/lib/url-validation";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalHttpUrl(value: unknown) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  return `https://${normalized}`;
}

const optionalText = (label: string, maxLength: number) =>
  z
    .any()
    .transform(normalizeOptionalString)
    .refine((value) => value === null || value.length <= maxLength, {
      message: `${label} is too long`,
    });

const optionalUrl = (label: string) =>
  z
    .any()
    .transform(normalizeOptionalHttpUrl)
    .refine((value) => value === null || isValidPublicUrl(value), {
      message: `Invalid ${label}`,
    });

const optionalEmail = z
  .any()
  .transform(normalizeOptionalString)
  .refine((value) => value === null || z.email().safeParse(value).success, {
    message: "Invalid contact email",
  });

const optionalPositiveInt = (label: string) =>
  z
    .union([z.number(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null))
    .refine((value) => value === null || Number.isInteger(value), {
      message: `Invalid ${label}`,
    });

const entryIdSchema = z.string().trim().min(1, "Entry id is required").max(100, "Entry id is too long");

const usernameSchema = z
  .any()
  .transform(normalizeOptionalString)
  .refine((value) => value === null || /^[a-z0-9._-]{3,32}$/i.test(value), {
    message: "Username must be 3-32 characters and use only letters, numbers, dots, underscores, or hyphens",
  })
  .transform((value) => value?.toLowerCase() || null);

const phoneSchema = z
  .any()
  .transform(normalizeOptionalString)
  .refine((value) => value === null || /^[+\d()[\]\s-]{7,32}$/.test(value), {
    message: "Invalid phone number",
  });

const telegramSchema = z
  .any()
  .transform(normalizeOptionalString)
  .refine((value) => value === null || /^@?[a-zA-Z0-9_]{5,32}$/.test(value), {
    message: "Invalid Telegram username",
  });

const visibilitySchema = z
  .record(z.string(), z.unknown())
  .default({})
  .transform((value) =>
    normalizeProfileSettings({
      ...createDefaultProfileVisibility(),
      ...value,
    }),
  );

const languageEntrySchema = z.object({
  id: entryIdSchema,
  language_id: optionalPositiveInt("language"),
  proficiency_level: z.enum(languageLevels),
});

const educationEntrySchema = z.object({
  id: entryIdSchema,
  institution: optionalText("Institution", 160),
  degree: optionalText("Degree", 160),
  field_of_study: optionalText("Field of study", 160),
  started_on: z.any().transform(normalizeOptionalString),
  completed_on: z.any().transform(normalizeOptionalString),
  description: optionalText("Education description", 2000),
});

const certificateEntrySchema = z.object({
  id: entryIdSchema,
  title: optionalText("Certificate title", 160),
  issuer: optionalText("Certificate issuer", 160),
  issued_on: z.any().transform(normalizeOptionalString),
  credential_url: optionalUrl("credential URL"),
  file_url: optionalUrl("certificate file URL"),
  file_name: optionalText("Certificate file name", 255),
  storage_path: optionalText("Certificate storage path", 500),
});

const qaEntrySchema = z.object({
  id: entryIdSchema,
  question: z.string().trim().min(1, "Question is required").max(300, "Question is too long"),
  answer: z.string().trim().min(1, "Answer is required").max(5000, "Answer is too long"),
});

const workExperienceEntrySchema = z
  .object({
    id: entryIdSchema,
    company_name: optionalText("Company name", 160),
    position: optionalText("Position", 160),
    started_year: z.union([z.number(), z.null()]).default(null),
    ended_year: z.union([z.number(), z.null()]).default(null),
    is_current: z.boolean(),
    responsibilities: optionalText("Responsibilities", 4000),
  })
  .superRefine((value, context) => {
    if (value.started_year !== null && (!Number.isInteger(value.started_year) || value.started_year < 1900 || value.started_year > 2100)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["started_year"],
        message: "Invalid work experience start year",
      });
    }

    if (value.ended_year !== null && (!Number.isInteger(value.ended_year) || value.ended_year < 1900 || value.ended_year > 2100)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ended_year"],
        message: "Invalid work experience end year",
      });
    }

    if (
      value.started_year !== null &&
      value.ended_year !== null &&
      !value.is_current &&
      value.ended_year < value.started_year
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ended_year"],
        message: "Work experience end year cannot be earlier than the start year",
      });
    }
  });

export const profilePayloadSchema = z.object({
  username: usernameSchema,
  name: optionalText("Full name", 120),
  category_id: optionalPositiveInt("category"),
  headline: optionalText("Headline", 160),
  bio: optionalText("Bio", 5000),
  country_id: optionalPositiveInt("country"),
  city: optionalText("City", 120),
  website: optionalUrl("website"),
  github: optionalUrl("GitHub URL"),
  twitter: optionalUrl("Twitter URL"),
  linkedin: optionalUrl("LinkedIn URL"),
  behance: optionalUrl("Behance URL"),
  dribbble: optionalUrl("Dribbble URL"),
  artstation: optionalUrl("ArtStation URL"),
  vimeo: optionalUrl("Vimeo URL"),
  youtube: optionalUrl("YouTube URL"),
  instagram: optionalUrl("Instagram URL"),
  contact_email: optionalEmail,
  telegram_username: telegramSchema,
  phone: phoneSchema,
  preferred_contact_method: z
    .union([z.enum(preferredContactMethods), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value && preferredContactMethods.includes(value) ? value : null)),
  experience_years: z.literal(null).default(null),
  experience_level: z
    .union([z.enum(experienceLevels), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value && experienceLevels.includes(value) ? value : null)),
  employment_types: z
    .array(z.enum(employmentTypes))
    .default([])
    .transform((values) => [...new Set(values)]),
  work_formats: z
    .array(z.enum(workFormats))
    .default([])
    .transform((values) => [...new Set(values)]),
  salary_expectations: optionalText("Salary expectations", 64),
  salary_currency: z
    .union([z.enum(salaryCurrencies), z.null(), z.undefined()])
    .transform((value) => (value && salaryCurrencies.includes(value) ? value : null)),
  additional_info: optionalText("Additional info", 5000),
  cover_url: optionalUrl("cover URL"),
  profile_visibility: visibilitySchema,
  skill_ids: z
    .array(z.number().int().positive())
    .default([])
    .transform((values) => [...new Set(values)]),
  languages: z.array(languageEntrySchema).max(50, "Too many languages").default([]),
  education: z.array(educationEntrySchema).max(50, "Too many education records").default([]),
  certificates: z.array(certificateEntrySchema).max(50, "Too many certificates").default([]),
  qas: z.array(qaEntrySchema).max(50, "Too many Q&A records").default([]),
  work_experience: z.array(workExperienceEntrySchema).max(50, "Too many work experience records").default([]),
});

export type ProfilePayload = z.infer<typeof profilePayloadSchema>;
