import { z } from "zod";
import {
  COMPANY_INVITE_ROLES,
  COMPANY_LIMITS,
  COMPANY_ROLES,
  COMPANY_SIZES,
  COMPANY_TYPES,
  isValidCompanySlug,
  normalizeCompanyWebsite,
} from "@/lib/companies";
import { moderationStatuses } from "@/lib/moderation";

const uuidMessage = "Invalid identifier";

const looseString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""));

function optionalText(max: number, label: string) {
  return looseString
    .refine((value) => value.length <= max, { message: `${label} is too long` })
    .transform((value) => value || null);
}

const optionalWebsite = looseString
  .refine((value) => value === "" || normalizeCompanyWebsite(value) !== null, {
    message: "Invalid website",
  })
  .transform((value) => (value ? normalizeCompanyWebsite(value) : null));

export const companyPayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(COMPANY_LIMITS.nameMin, "Name is too short")
    .max(COMPANY_LIMITS.nameMax, "Name is too long"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidCompanySlug, { message: "Invalid page address" }),
  type: z.enum(COMPANY_TYPES).default("company"),
  description: optionalText(COMPANY_LIMITS.descriptionMax, "Description"),
  website: optionalWebsite,
  size: z
    .union([z.enum(COMPANY_SIZES), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value || null),
  country_id: z
    .union([z.number().int().positive(), z.null(), z.undefined()])
    .transform((value) => value ?? null),
  city: optionalText(COMPANY_LIMITS.cityMax, "City"),
});

export type CompanyPayload = z.infer<typeof companyPayloadSchema>;

/**
 * The logo is saved on its own, right after the upload (the storage key is
 * the company's, see buildCompanyLogoKey). The route checks it is that key.
 */
export const companyLogoSchema = z.object({
  logoUrl: z.string().trim().url("Invalid logo").max(COMPANY_LIMITS.websiteMax, "Invalid logo"),
});

export const routeCompanyIdSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

export const routeCompanyMemberSchema = z.object({
  id: z.string().uuid(uuidMessage),
  memberId: z.string().uuid(uuidMessage),
});

export const routeCompanyInvitationSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

export const inviteCompanyMemberSchema = z.object({
  userId: z.string().uuid(uuidMessage),
  role: z.enum(COMPANY_INVITE_ROLES).default("recruiter"),
});

export const updateCompanyMemberSchema = z.object({
  role: z.enum(COMPANY_ROLES),
});

export const respondCompanyInvitationSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export const adminCompanyUpdateSchema = z
  .object({
    verified: z.boolean().optional(),
    moderation_status: z.enum(moderationStatuses).optional(),
    moderation_note: z
      .string()
      .trim()
      .max(1000, "Note is too long")
      .optional()
      .transform((value) => value || null),
  })
  .refine(
    (value) => value.verified !== undefined || value.moderation_status !== undefined,
    { message: "Nothing to update" },
  );

export type AdminCompanyUpdate = z.infer<typeof adminCompanyUpdateSchema>;
