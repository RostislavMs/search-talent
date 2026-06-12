import { NextResponse } from "next/server";
import { generateUniqueProjectSlug } from "@/lib/projects";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { deleteStorageObject } from "@/lib/storage/provider";
import { createClient } from "@/lib/supabase/server";
import { projectPayloadSchema, routeProjectIdSchema } from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";
import { normalizeProjectKindMetadata } from "@/lib/project-kind-metadata";
import { isPublicModerationStatus } from "@/lib/moderation";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  collectProjectModerationText,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeProjectIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.issues[0]?.message || "Invalid project id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, slug, moderation_status, followers_notified_at")
    .eq("id", id)
    .maybeSingle();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const parsed = await parseJsonRequest(request, projectPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;

  // Auto-moderation runs only on publish, and only auto-removes a currently
  // approved item — it never touches content an admin already
  // restricted/removed or that is awaiting review.
  const screen =
    payload.status === "published"
      ? screenContentForModeration(collectProjectModerationText(payload))
      : { flagged: false as const, categories: [], note: null };
  const willRemove = screen.flagged && project.moderation_status === "approved";

  const nextSlug =
    payload.slug === project.slug
      ? project.slug
      : await generateUniqueProjectSlug(supabase, payload.slug, project.id);

  const { data: updatedProject, error: projectError } = await supabase
    .from("projects")
    .update({
      title: payload.title,
      slug: nextSlug,
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
      status: payload.status,
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
    })
    .eq("id", project.id)
    .eq("owner_id", user.id)
    .select("slug, status")
    .single();

  if (projectError || !updatedProject) {
    return NextResponse.json(
      { error: projectError?.message || "Could not update project" },
      { status: 400 },
    );
  }

  if (willRemove) {
    await autoRemoveContent({
      table: "projects",
      id: project.id,
      note: screen.note,
    });
  }

  const { error: deleteSkillsError } = await supabase
    .from("project_skills")
    .delete()
    .eq("project_id", project.id);

  if (deleteSkillsError) {
    return NextResponse.json(
      { error: deleteSkillsError.message },
      { status: 400 },
    );
  }

  if (payload.skillIds.length > 0) {
    const { error: skillError } = await supabase.from("project_skills").insert(
      payload.skillIds.map((skillId) => ({
        project_id: project.id,
        skill_id: skillId,
      })),
    );

    if (skillError) {
      return NextResponse.json(
        { error: skillError.message },
        { status: 400 },
      );
    }
  }

  // First publish (draft -> published) notifies the owner's followers. The
  // followers_notified_at guard keeps re-publishes and later edits silent.
  // A freshly auto-removed edit is not public, so it must not notify.
  if (
    updatedProject.status === "published" &&
    !willRemove &&
    !project.followers_notified_at &&
    isPublicModerationStatus(project.moderation_status)
  ) {
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
    slug: updatedProject.slug,
    status: updatedProject.status,
    autoRemoved: willRemove,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeProjectIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.issues[0]?.message || "Invalid project id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: mediaItems, error: mediaError } = await supabase
    .from("project_media")
    .select("url, storage_path")
    .eq("project_id", project.id);

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 400 });
  }

  const { error: deleteProjectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id)
    .eq("owner_id", user.id);

  if (deleteProjectError) {
    return NextResponse.json(
      { error: deleteProjectError.message || "Could not delete project" },
      { status: 400 },
    );
  }

  const itemsToClean = (mediaItems || []).filter(
    (item): item is { url: string; storage_path: string } =>
      Boolean(item.storage_path && item.url),
  );

  const cleanupWarnings: string[] = [];

  for (const item of itemsToClean) {
    const { error: storageError } = await deleteStorageObject({
      supabase,
      bucket: "project-media",
      url: item.url,
      storagePath: item.storage_path,
    });

    if (storageError) {
      cleanupWarnings.push(storageError.message);
    }
  }

  if (cleanupWarnings.length > 0) {
    return NextResponse.json({
      success: true,
      cleanupWarning: cleanupWarnings[0],
    });
  }

  return NextResponse.json({ success: true });
}
