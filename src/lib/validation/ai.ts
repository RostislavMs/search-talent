import { z } from "zod";
import { GITHUB_PROJECT_ROLES } from "@/lib/constants/github";
import { isLocale } from "@/lib/i18n/config";

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
      projectRole: z.string().max(160).optional(),
      problem: z.string().max(5000).optional(),
      solution: z.string().max(5000).optional(),
      results: z.string().max(5000).optional(),
    })
    .partial()
    .optional()
    .default({}),
});

export type GithubDraftPayload = z.infer<typeof githubDraftPayloadSchema>;
