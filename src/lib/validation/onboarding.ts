import { z } from "zod";
import { ONBOARDING_MAX_SKILLS } from "@/lib/onboarding";
import { USERNAME_PATTERN } from "@/lib/username";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const onboardingUsernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, "invalid_username")
  .transform((value) => value.toLowerCase());

/** The "who you are" step: a subset of the profile, saved on its own. */
export const onboardingProfileSchema = z.object({
  name: z
    .any()
    .transform(normalizeOptionalString)
    .refine((value) => value === null || value.length <= 120, { message: "name_too_long" }),
  username: onboardingUsernameSchema,
  category_id: z
    .union([z.number(), z.null(), z.undefined()])
    .transform((value) =>
      typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null,
    ),
  skill_ids: z
    .array(z.number().int().positive())
    .max(ONBOARDING_MAX_SKILLS, "too_many_skills")
    .default([])
    .transform((values) => [...new Set(values)]),
});

export type OnboardingProfilePayload = z.infer<typeof onboardingProfileSchema>;

export const onboardingMarkSchema = z.object({
  action: z.enum(["completed", "link_shared"]),
});
