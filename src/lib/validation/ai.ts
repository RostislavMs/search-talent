import { z } from "zod";
import { GITHUB_PROJECT_ROLES } from "@/lib/constants/github";
import { providerIntegrationIds } from "@/lib/constants/provider-integrations";
import { isLocale } from "@/lib/i18n/config";
import { projectKinds } from "@/lib/projects";

/**
 * The project kind the draft is for. Present (even as null) → the draft also
 * fills the kind's details and the technology tags; absent → the story only.
 */
const draftKindSchema = z.enum(projectKinds).nullable().optional();

/**
 * Body for `POST /api/ai/github-draft`. The server re-fetches the
 * full repo via the user's GitHub token; the client only supplies
 * the repo identifier and the fields it has already filled.
 */
export const githubDraftPayloadSchema = z.object({
  fullName: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/,
      "Invalid GitHub repository identifier",
    ),
  locale: z
    .string()
    .optional()
    .transform((value) => (value && isLocale(value) ? value : "en")),
  existing: z
    .object({
      role: z
        .union([z.enum(GITHUB_PROJECT_ROLES), z.literal(""), z.null()])
        .optional()
        .transform((value) => (value && value.length > 0 ? value : null)),
      contribution: z.string().max(2000).optional(),
      motivation: z.string().max(1500).optional(),
      techDecisions: z.string().max(2000).optional(),
      learnings: z.string().max(1500).optional(),
      showcaseNotes: z.string().max(1500).optional(),
      productionUsage: z.string().max(500).optional(),
      description: z.string().max(5000).optional(),
      projectRole: z.string().max(160).optional(),
      problem: z.string().max(5000).optional(),
      solution: z.string().max(5000).optional(),
      results: z.string().max(5000).optional(),
    })
    .partial()
    .optional()
    .default({}),
  kind: draftKindSchema,
});

export type GithubDraftPayload = z.infer<typeof githubDraftPayloadSchema>;

/**
 * Body for `POST /api/ai/source-draft`. As with the GitHub draft, the server
 * re-fetches the resource through the user's own provider token — the client
 * only names it and says which fields it has already filled.
 */
export const sourceDraftPayloadSchema = z.object({
  provider: z.enum(providerIntegrationIds),
  ref: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Invalid integration ref"),
  locale: z
    .string()
    .optional()
    .transform((value) => (value && isLocale(value) ? value : "en")),
  existing: z
    .object({
      description: z.string().max(5000).optional(),
      projectRole: z.string().max(160).optional(),
      problem: z.string().max(5000).optional(),
      solution: z.string().max(5000).optional(),
      results: z.string().max(5000).optional(),
    })
    .partial()
    .optional()
    .default({}),
  kind: draftKindSchema,
});

export type SourceDraftPayload = z.infer<typeof sourceDraftPayloadSchema>;
