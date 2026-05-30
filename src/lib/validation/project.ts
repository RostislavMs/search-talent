import { z } from "zod";
import {
  projectKinds,
  projectStatuses,
  projectVisibilityStatuses,
  slugify,
  type ProjectKind,
  type ProjectStatus,
  type ProjectVisibilityStatus,
} from "@/lib/projects";
import {
  audioDaws,
  audioGenres,
  audioKeys,
  audioRoles,
  codeArchitectures,
  codeDatabases,
  codeHostings,
  codeLanguages,
  codeLicenses,
  designDeliverables,
  designRoles,
  designTools,
  motionPurposes,
  motionRoles,
  motionTechniques,
  motionTools,
  photoCameraBrands,
  photoEditingTools,
  photoGenres,
  photoMediums,
  photoRoles,
  qaCertifications,
  qaMethodologies,
  qaRoles,
  qaTestTypes,
  qaTools,
  threeDRenderEngines,
  threeDRoles,
  threeDSoftware,
  threeDStyles,
  videoFrameRates,
  videoGenres,
  videoResolutions,
  videoRoles,
  videoTools,
  writingFormats,
  writingLanguages,
  writingRoles,
  writingTools,
  writingTopics,
} from "@/lib/project-kind-metadata";
import {
  GITHUB_FIELD_LIMITS,
  GITHUB_PROJECT_ROLES,
} from "@/lib/constants/github";
import { isValidPublicUrl } from "@/lib/url-validation";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
    .transform(normalizeOptionalString)
    .refine((value) => value === null || isValidPublicUrl(value), {
      message: `Invalid ${label}`,
    });

const optionalDate = (label: string) =>
  z
    .any()
    .transform(normalizeOptionalString)
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: `Invalid ${label}`,
    });

const optionalPositiveInteger = (label: string) =>
  z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
    })
    .refine((value) => value === null || Number.isInteger(value), {
      message: `Invalid ${label}`,
    });

const skillIdsSchema = z
  .array(z.union([z.number(), z.string()]))
  .default([])
  .transform((values) => [
    ...new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ]);

export const projectPayloadSchema = z
  .object({
    title: z.string().trim().min(1, "Project title is required").max(120, "Project title is too long"),
    slug: z.any().optional(),
    description: optionalText("Project description", 5000),
    role: optionalText("Project role", 160),
    kind: z
      .union([z.enum(projectKinds), z.literal(""), z.null(), z.undefined()])
      .transform((value): ProjectKind | null =>
        value && projectKinds.includes(value as ProjectKind)
          ? (value as ProjectKind)
          : null,
      ),
    kindMetadata: z
      .object({
        design: z
          .object({
            role: z
              .union([z.enum(designRoles), z.literal(""), z.null(), z.undefined()])
              .transform((value) =>
                value && (designRoles as readonly string[]).includes(value)
                  ? (value as (typeof designRoles)[number])
                  : null,
              ),
            tools: z
              .array(z.enum(designTools))
              .max(20, "Too many tools")
              .default([])
              .transform((values) => [...new Set(values)]),
            figmaUrl: optionalUrl("Figma URL"),
            behanceUrl: optionalUrl("Behance URL"),
            dribbbleUrl: optionalUrl("Dribbble URL"),
            client: optionalText("Client", 160),
            deliverables: z
              .array(z.enum(designDeliverables))
              .max(20, "Too many deliverables")
              .default([])
              .transform((values) => [...new Set(values)]),
          })
          .partial()
          .optional(),
        code: z
          .object({
            architecture: z
              .union([
                z.enum(codeArchitectures),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (codeArchitectures as readonly string[]).includes(value)
                  ? (value as (typeof codeArchitectures)[number])
                  : null,
              ),
            primaryLanguage: z
              .union([
                z.enum(codeLanguages),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (codeLanguages as readonly string[]).includes(value)
                  ? (value as (typeof codeLanguages)[number])
                  : null,
              ),
            hosting: z
              .array(z.enum(codeHostings))
              .max(20, "Too many hosting platforms")
              .default([])
              .transform((values) => [...new Set(values)]),
            databases: z
              .array(z.enum(codeDatabases))
              .max(20, "Too many databases")
              .default([])
              .transform((values) => [...new Set(values)]),
            license: z
              .union([
                z.enum(codeLicenses),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (codeLicenses as readonly string[]).includes(value)
                  ? (value as (typeof codeLicenses)[number])
                  : null,
              ),
            docsUrl: optionalUrl("docs URL"),
            storybookUrl: optionalUrl("Storybook URL"),
            apiPlaygroundUrl: optionalUrl("API playground URL"),
          })
          .partial()
          .optional(),
        video: z
          .object({
            role: z
              .union([
                z.enum(videoRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (videoRoles as readonly string[]).includes(value)
                  ? (value as (typeof videoRoles)[number])
                  : null,
              ),
            tools: z
              .array(z.enum(videoTools))
              .max(20, "Too many tools")
              .default([])
              .transform((values) => [...new Set(values)]),
            genres: z
              .array(z.enum(videoGenres))
              .max(20, "Too many genres")
              .default([])
              .transform((values) => [...new Set(values)]),
            resolution: z
              .union([
                z.enum(videoResolutions),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (videoResolutions as readonly string[]).includes(value)
                  ? (value as (typeof videoResolutions)[number])
                  : null,
              ),
            frameRate: z
              .union([
                z.enum(videoFrameRates),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (videoFrameRates as readonly string[]).includes(value)
                  ? (value as (typeof videoFrameRates)[number])
                  : null,
              ),
            durationSeconds: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 24 * 60 * 60);
              }),
            showreelUrl: optionalUrl("showreel URL"),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
        photo: z
          .object({
            role: z
              .union([
                z.enum(photoRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (photoRoles as readonly string[]).includes(value)
                  ? (value as (typeof photoRoles)[number])
                  : null,
              ),
            genres: z
              .array(z.enum(photoGenres))
              .max(20, "Too many genres")
              .default([])
              .transform((values) => [...new Set(values)]),
            cameras: z
              .array(z.enum(photoCameraBrands))
              .max(20, "Too many cameras")
              .default([])
              .transform((values) => [...new Set(values)]),
            editingTools: z
              .array(z.enum(photoEditingTools))
              .max(20, "Too many editing tools")
              .default([])
              .transform((values) => [...new Set(values)]),
            medium: z
              .union([
                z.enum(photoMediums),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (photoMediums as readonly string[]).includes(value)
                  ? (value as (typeof photoMediums)[number])
                  : null,
              ),
            shotCount: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 1_000_000);
              }),
            location: optionalText("Location", 160),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
        threeD: z
          .object({
            role: z
              .union([
                z.enum(threeDRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (threeDRoles as readonly string[]).includes(value)
                  ? (value as (typeof threeDRoles)[number])
                  : null,
              ),
            software: z
              .array(z.enum(threeDSoftware))
              .max(20, "Too many software")
              .default([])
              .transform((values) => [...new Set(values)]),
            renderEngine: z
              .union([
                z.enum(threeDRenderEngines),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value &&
                (threeDRenderEngines as readonly string[]).includes(value)
                  ? (value as (typeof threeDRenderEngines)[number])
                  : null,
              ),
            styles: z
              .array(z.enum(threeDStyles))
              .max(20, "Too many styles")
              .default([])
              .transform((values) => [...new Set(values)]),
            polygonCount: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 1_000_000_000);
              }),
            modelUrl: optionalUrl("model URL"),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
        audio: z
          .object({
            role: z
              .union([
                z.enum(audioRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (audioRoles as readonly string[]).includes(value)
                  ? (value as (typeof audioRoles)[number])
                  : null,
              ),
            genres: z
              .array(z.enum(audioGenres))
              .max(20, "Too many genres")
              .default([])
              .transform((values) => [...new Set(values)]),
            daws: z
              .array(z.enum(audioDaws))
              .max(20, "Too many DAWs")
              .default([])
              .transform((values) => [...new Set(values)]),
            trackUrl: optionalUrl("track URL"),
            durationSeconds: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 12 * 60 * 60);
              }),
            bpm: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 400);
              }),
            musicalKey: z
              .union([
                z.enum(audioKeys),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (audioKeys as readonly string[]).includes(value)
                  ? (value as (typeof audioKeys)[number])
                  : null,
              ),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
        qa: z
          .object({
            role: z
              .union([
                z.enum(qaRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (qaRoles as readonly string[]).includes(value)
                  ? (value as (typeof qaRoles)[number])
                  : null,
              ),
            testTypes: z
              .array(z.enum(qaTestTypes))
              .max(20, "Too many test types")
              .default([])
              .transform((values) => [...new Set(values)]),
            tools: z
              .array(z.enum(qaTools))
              .max(30, "Too many tools")
              .default([])
              .transform((values) => [...new Set(values)]),
            methodologies: z
              .array(z.enum(qaMethodologies))
              .max(20, "Too many methodologies")
              .default([])
              .transform((values) => [...new Set(values)]),
            certifications: z
              .array(z.enum(qaCertifications))
              .max(20, "Too many certifications")
              .default([])
              .transform((values) => [...new Set(values)]),
            testCasesCount: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 1_000_000);
              }),
            bugsFoundCount: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 1_000_000);
              }),
            automationCoveragePercent: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                  return null;
                }
                return Math.round(parsed);
              }),
            reportUrl: optionalUrl("report URL"),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
        motion: z
          .object({
            role: z
              .union([
                z.enum(motionRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (motionRoles as readonly string[]).includes(value)
                  ? (value as (typeof motionRoles)[number])
                  : null,
              ),
            techniques: z
              .array(z.enum(motionTechniques))
              .max(20, "Too many techniques")
              .default([])
              .transform((values) => [...new Set(values)]),
            tools: z
              .array(z.enum(motionTools))
              .max(20, "Too many tools")
              .default([])
              .transform((values) => [...new Set(values)]),
            purposes: z
              .array(z.enum(motionPurposes))
              .max(20, "Too many purposes")
              .default([])
              .transform((values) => [...new Set(values)]),
            durationSeconds: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 24 * 60 * 60);
              }),
            previewUrl: optionalUrl("preview URL"),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
        writing: z
          .object({
            role: z
              .union([
                z.enum(writingRoles),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (writingRoles as readonly string[]).includes(value)
                  ? (value as (typeof writingRoles)[number])
                  : null,
              ),
            formats: z
              .array(z.enum(writingFormats))
              .max(20, "Too many formats")
              .default([])
              .transform((values) => [...new Set(values)]),
            topics: z
              .array(z.enum(writingTopics))
              .max(20, "Too many topics")
              .default([])
              .transform((values) => [...new Set(values)]),
            tools: z
              .array(z.enum(writingTools))
              .max(20, "Too many tools")
              .default([])
              .transform((values) => [...new Set(values)]),
            language: z
              .union([
                z.enum(writingLanguages),
                z.literal(""),
                z.null(),
                z.undefined(),
              ])
              .transform((value) =>
                value && (writingLanguages as readonly string[]).includes(value)
                  ? (value as (typeof writingLanguages)[number])
                  : null,
              ),
            wordCount: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 10_000_000);
              }),
            readingTimeMinutes: z
              .union([z.number(), z.string(), z.null(), z.undefined()])
              .transform((value) => {
                if (value === null || value === undefined || value === "") {
                  return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  return null;
                }
                return Math.min(Math.floor(parsed), 10_000);
              }),
            articleUrl: optionalUrl("article URL"),
            client: optionalText("Client", 160),
          })
          .partial()
          .optional(),
      })
      .partial()
      .nullable()
      .optional()
      .transform((value) => value ?? {}),
    projectStatus: z
      .union([z.enum(projectStatuses), z.literal(""), z.null(), z.undefined()])
      .transform((value) => (value && projectStatuses.includes(value as ProjectStatus) ? value : null)),
    teamSize: optionalPositiveInteger("team size"),
    projectUrl: optionalUrl("project URL"),
    repositoryUrl: optionalUrl("repository URL"),
    startedOn: optionalDate("start date"),
    completedOn: optionalDate("completion date"),
    problem: optionalText("Problem", 5000),
    solution: optionalText("Solution", 5000),
    results: optionalText("Results", 5000),
    skillIds: skillIdsSchema,
    githubFullName: z
      .union([
        z
          .string()
          .trim()
          .regex(
            /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/,
            "Invalid GitHub repository identifier",
          ),
        z.literal(""),
        z.null(),
        z.undefined(),
      ])
      .transform((value) =>
        typeof value === "string" && value.length > 0 ? value : null,
      ),
    githubRole: z
      .union([
        z.enum(GITHUB_PROJECT_ROLES),
        z.literal(""),
        z.null(),
        z.undefined(),
      ])
      .transform((value) =>
        value && GITHUB_PROJECT_ROLES.includes(value as never)
          ? (value as (typeof GITHUB_PROJECT_ROLES)[number])
          : null,
      ),
    githubContribution: optionalText(
      "Contribution",
      GITHUB_FIELD_LIMITS.contribution,
    ),
    githubMotivation: optionalText(
      "Motivation",
      GITHUB_FIELD_LIMITS.motivation,
    ),
    githubTechDecisions: optionalText(
      "Technical decisions",
      GITHUB_FIELD_LIMITS.techDecisions,
    ),
    githubLearnings: optionalText(
      "Learnings",
      GITHUB_FIELD_LIMITS.learnings,
    ),
    githubShowcaseNotes: optionalText(
      "Showcase notes",
      GITHUB_FIELD_LIMITS.showcaseNotes,
    ),
    githubProductionUsage: optionalText(
      "Production usage",
      GITHUB_FIELD_LIMITS.productionUsage,
    ),
    githubDisplayOptions: z
      .object({
        showStats: z.boolean(),
        showLanguages: z.boolean(),
        showRelease: z.boolean(),
        showLicense: z.boolean(),
        showContributors: z.boolean(),
        showActivity: z.boolean(),
        showTopics: z.boolean(),
        showReadme: z.boolean(),
      })
      .partial()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    githubAutoSync: z
      .union([z.boolean(), z.null(), z.undefined()])
      .transform((value) => (typeof value === "boolean" ? value : true)),
    status: z
      .union([z.enum(projectVisibilityStatuses), z.null(), z.undefined()])
      .transform((value): ProjectVisibilityStatus =>
        value && projectVisibilityStatuses.includes(value as ProjectVisibilityStatus)
          ? (value as ProjectVisibilityStatus)
          : "published",
      ),
  })
  .transform((value) => {
    const explicitSlug = normalizeOptionalString(value.slug);
    const slug = slugify(explicitSlug || value.title) || "project";

    return {
      ...value,
      slug,
    };
  })
  .superRefine((value, context) => {
    if (value.startedOn && value.completedOn && value.completedOn < value.startedOn) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completedOn"],
        message: "Project completion date cannot be earlier than the start date",
      });
    }
  });

export const routeProjectIdSchema = z.object({
  id: z.string().uuid("Invalid project id"),
});

export const projectCommentPayloadSchema = z.object({
  body: z.string().trim().min(1, "Comment is required").max(4000, "Comment is too long"),
  parent_id: z.string().uuid().nullable().default(null),
});

export type ProjectPayload = z.infer<typeof projectPayloadSchema>;
