import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { routeProjectIdSchema } from "@/lib/validation/project";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeProjectIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid project id" },
      { status: 400 },
    );
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = routeParams.data;
  const { data: project, error: projectError } = await context.supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Into the trash for 60 days (a database trigger); the files stay in
  // storage until the trash is emptied, so the project can be restored.
  const { error: deleteError } = await context.supabase
    .from("projects")
    .delete()
    .eq("id", project.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Could not delete project" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
