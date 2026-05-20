import { NextResponse } from "next/server";
import { generateUniqueProjectSlug } from "@/lib/projects";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { projectPayloadSchema } from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";

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
