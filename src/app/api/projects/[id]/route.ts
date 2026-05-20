import { NextResponse } from "next/server";
import { generateUniqueProjectSlug } from "@/lib/projects";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { projectPayloadSchema, routeProjectIdSchema } from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";

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
    .select("id, owner_id, slug")
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

  return NextResponse.json({
    success: true,
    projectId: project.id,
    slug: updatedProject.slug,
    status: updatedProject.status,
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
    .select("storage_path")
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

  const storagePaths = [...new Set(
    (mediaItems || [])
      .map((item) => item.storage_path?.trim())
      .filter((path): path is string => Boolean(path)),
  )];

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("project-media")
      .remove(storagePaths);

    if (storageError) {
      return NextResponse.json({
        success: true,
        cleanupWarning: storageError.message,
      });
    }
  }

  return NextResponse.json({ success: true });
}
