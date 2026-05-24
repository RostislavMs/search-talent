import { NextResponse } from "next/server";
import { generateUniqueProjectSlug } from "@/lib/projects";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { projectPayloadSchema } from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { mapRepoToProjectColumns } from "@/lib/db/github-sync";

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

  const uniqueSlug = await generateUniqueProjectSlug(supabase, payload.slug);

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

  return NextResponse.json({
    success: true,
    projectId: project.id,
    slug: project.slug,
    status: project.status,
  });
}
