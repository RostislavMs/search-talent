import { NextResponse } from "next/server";
import { generateUniqueProjectSlug } from "@/lib/projects";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { projectPayloadSchema } from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { mapRepoToProjectColumns } from "@/lib/db/github-sync";
import { normalizeProjectKindMetadata } from "@/lib/project-kind-metadata";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  collectProjectModerationText,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { inviteCoAuthors } from "@/lib/db/co-authors";
import { sanitizeCoAuthorIds } from "@/lib/co-authors";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, projectPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;

  // Co-authors invited at creation: the work is held as a draft until every
  // invitee accepts, then auto-published (see respondToCoAuthorInvitation).
  const coAuthorIds = sanitizeCoAuthorIds(payload.coAuthorUserIds, user.id);
  const holdForCoAuthors = payload.status === "published" && coAuthorIds.length > 0;

  const uniqueSlug = await generateUniqueProjectSlug(supabase, payload.slug);

  // Auto-moderation runs only on publish. A flagged project is auto-removed
  // (hidden by RLS) right after insert and the author is notified; clean
  // content keeps the previous auto-approve behaviour.
  const screen =
    payload.status === "published"
      ? screenContentForModeration(collectProjectModerationText(payload))
      : { flagged: false as const, categories: [], note: null };

  // If the form supplied a GitHub repo, snapshot it server-side so the
  // denormalized columns (stats, languages, sync timestamp) are filled
  // on create. Failure to reach GitHub is non-fatal: the project still
  // saves with whatever fields the user filled manually.
  let githubColumns: Record<string, unknown> = {};
  if (payload.githubFullName) {
    const integration = await getIntegrationForUser(supabase, user.id);
    if (integration) {
      const detail = await fetchRepoFullDetail(
        integration.access_token,
        payload.githubFullName,
      );
      if (detail) {
        githubColumns = mapRepoToProjectColumns(detail, {
          description: payload.description,
          project_status: payload.projectStatus,
          team_size: payload.teamSize,
          started_on: payload.startedOn,
        });
      }
    }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      title: payload.title,
      slug: uniqueSlug,
      description: payload.description
        ? sanitizeRichTextHtml(payload.description)
        : payload.description,
      role: payload.role,
      kind: payload.kind,
      kind_metadata: normalizeProjectKindMetadata(
        payload.kind,
        payload.kindMetadata,
      ),
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
      github_display_options: payload.githubDisplayOptions ?? undefined,
      github_auto_sync: payload.githubAutoSync,
      allow_downloads: payload.allowDownloads,
      status: holdForCoAuthors ? "draft" : payload.status,
      publish_on_confirm: holdForCoAuthors,
      ...githubColumns,
    })
    .select("id, slug, status")
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message || "Could not create project" },
      { status: 400 },
    );
  }

  if (screen.flagged) {
    await autoRemoveContent({ table: "projects", id: project.id, note: screen.note });
  }

  if (payload.skillIds.length > 0) {
    const { error: skillError } = await supabase.from("project_skills").insert(
      payload.skillIds.map((skillId) => ({
        project_id: project.id,
        skill_id: skillId,
      })),
    );

    if (skillError) {
      await supabase.from("projects").delete().eq("id", project.id);

      return NextResponse.json(
        { error: skillError.message },
        { status: 400 },
      );
    }
  }

  // Invite co-authors (pending until they accept). Skip when the project was
  // flagged and auto-removed — there is nothing to collaborate on yet.
  if (coAuthorIds.length > 0 && !screen.flagged) {
    await inviteCoAuthors({
      supabase,
      contentType: "project",
      contentId: project.id,
      contentTitle: payload.title,
      contentSlug: project.slug,
      creatorUserId: user.id,
      coAuthorUserIds: coAuthorIds,
    });
  }

  // Notify followers only when the project is actually public (published AND
  // not auto-removed). A draft held for co-authors notifies on auto-publish.
  if (project.status === "published" && !screen.flagged) {
    void dispatchPublishSideEffects({
      contentType: "project",
      contentId: project.id,
      authorUserId: user.id,
      title: payload.title,
    });
  }

  return NextResponse.json({
    success: true,
    projectId: project.id,
    slug: project.slug,
    status: project.status,
    autoRemoved: screen.flagged,
    awaitingCoAuthors: holdForCoAuthors,
  });
}
