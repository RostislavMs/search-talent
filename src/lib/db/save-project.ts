import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { notifyCompanyProjectRequest } from "@/lib/db/companies";
import {
  notifyCoAuthorInvites,
  parseNewCoAuthorInvites,
  type NewCoAuthorInvite,
} from "@/lib/db/co-authors";
import type { EditorProjectBudget } from "@/lib/project-context";
import { normalizeProjectKindMetadata } from "@/lib/project-kind-metadata";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import type { projectPayloadSchema } from "@/lib/validation/project";

type ProjectPayload = z.infer<typeof projectPayloadSchema>;

/**
 * The project's own columns from the form, as `save_project` takes them.
 * Status, slug and the GitHub/GitLab snapshot are added by the route.
 */
export function buildProjectRow(payload: ProjectPayload): Record<string, unknown> {
  return {
    title: payload.title,
    description: payload.description
      ? sanitizeRichTextHtml(payload.description)
      : payload.description,
    role: payload.role,
    kind: payload.kind,
    kind_metadata: normalizeProjectKindMetadata(payload.kind, payload.kindMetadata),
    project_status: payload.projectStatus,
    team_size: payload.teamSize,
    project_url: payload.projectUrl,
    repository_url: payload.repositoryUrl,
    started_on: payload.startedOn,
    completed_on: payload.completedOn,
    problem: payload.problem,
    solution: payload.solution,
    results: payload.results,
    github_role: payload.githubRole,
    github_contribution: payload.githubContribution,
    github_motivation: payload.githubMotivation,
    github_tech_decisions: payload.githubTechDecisions,
    github_learnings: payload.githubLearnings,
    github_showcase_notes: payload.githubShowcaseNotes,
    github_production_usage: payload.githubProductionUsage,
    // Left out when the form sends none, so the stored choice stays.
    ...(payload.githubDisplayOptions ? { github_display_options: payload.githubDisplayOptions } : {}),
    github_auto_sync: payload.githubAutoSync,
    allow_downloads: payload.allowDownloads,
    origin: payload.origin,
    client_name: payload.clientName,
    client_nda: payload.clientNda,
  };
}

export type SavedProject = {
  id: string;
  slug: string;
  status: string;
  /** Co-authors invited by this save. */
  invited: NewCoAuthorInvite[];
  /** Company pages that now wait for the company to accept the project. */
  companyRequests: string[];
};

export function parseSavedProject(value: unknown): SavedProject | null {
  const row = value as {
    id?: unknown;
    slug?: unknown;
    status?: unknown;
    invited?: unknown;
    companyRequests?: unknown;
  } | null;

  if (!row || typeof row.id !== "string" || typeof row.slug !== "string" || typeof row.status !== "string") {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    invited: parseNewCoAuthorInvites(row.invited),
    companyRequests: Array.isArray(row.companyRequests)
      ? row.companyRequests.filter((item): item is string => typeof item === "string")
      : [],
  };
}

/**
 * Creates (`id` null) or updates a project with its skills, budget,
 * co-authors and company pages in one transaction. `coAuthorIds` and
 * `companyIds` null leave those as they are; `budget` null removes it.
 */
export async function saveProject(
  supabase: SupabaseClient,
  input: {
    id: string | null;
    row: Record<string, unknown>;
    skillIds: number[];
    budget: EditorProjectBudget | null;
    coAuthorIds: string[] | null;
    companyIds: string[] | null;
  },
): Promise<{ project: SavedProject; error: null } | { project: null; error: { message: string; code?: string } }> {
  const { data, error } = await supabase.rpc("save_project", {
    p_id: input.id,
    p_row: input.row,
    p_skill_ids: input.skillIds,
    p_budget: input.budget,
    p_co_author_ids: input.coAuthorIds,
    p_company_ids: input.companyIds,
  });

  const project = error ? null : parseSavedProject(data);

  if (!project) {
    return {
      project: null,
      error: { message: error?.message || "Could not save project", code: error?.code },
    };
  }

  return { project, error: null };
}

/**
 * After the save: invitations to the new co-authors, and — for a published
 * project — a request to each company page that has to accept it. A failure
 * is logged by the helpers, never thrown.
 */
export async function notifyProjectSaved(params: {
  project: SavedProject;
  title: string;
  creatorUserId: string;
}): Promise<void> {
  const { project, title, creatorUserId } = params;

  await notifyCoAuthorInvites({
    contentType: "project",
    contentId: project.id,
    contentTitle: title,
    contentSlug: project.slug,
    creatorUserId,
    invited: project.invited,
  });

  if (project.status === "published") {
    for (const companyId of project.companyRequests) {
      await notifyCompanyProjectRequest({ companyId, projectId: project.id, actorUserId: creatorUserId });
    }
  }
}
