import { z } from "zod";
import { APPLICATION_LIMITS, TEAM_APPLICATION_STATUSES } from "@/lib/applications";

const uuidMessage = "Invalid identifier";

/**
 * What the apply form sends. The consent is explicit: the company gets the
 * profile, the chosen projects, the message and the contacts. The database
 * checks the projects themselves (published, the candidate's own).
 */
export const applyToVacancySchema = z.object({
  message: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .refine((value) => value.length <= APPLICATION_LIMITS.messageMax, {
      message: "The message is too long",
    }),
  project_ids: z
    .array(z.string().uuid(uuidMessage))
    .transform((values) => [...new Set(values)])
    .refine((values) => values.length >= APPLICATION_LIMITS.projectsMin, {
      message: "Choose at least one project",
    })
    .refine((values) => values.length <= APPLICATION_LIMITS.projectsMax, {
      message: "Too many projects",
    }),
  consent: z.literal(true, { message: "Consent is required" }),
});

export type ApplyToVacancyPayload = z.infer<typeof applyToVacancySchema>;

export const applicationStatusSchema = z.object({
  status: z.enum(TEAM_APPLICATION_STATUSES),
});

export const markApplicationsViewedSchema = z.object({
  ids: z
    .array(z.string().uuid(uuidMessage))
    .min(1)
    .max(APPLICATION_LIMITS.viewedBatchMax)
    .transform((values) => [...new Set(values)]),
});

export const routeApplicationIdSchema = z.object({
  id: z.string().uuid(uuidMessage),
});
