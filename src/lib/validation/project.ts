import { z } from "zod";
import {
  projectStatuses,
  projectVisibilityStatuses,
  slugify,
  type ProjectStatus,
  type ProjectVisibilityStatus,
} from "@/lib/projects";

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
    .refine((value) => value === null || (value.length <= 2048 && isValidUrl(value)), {
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
