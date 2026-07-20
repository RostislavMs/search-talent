import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { routeProjectIdSchema } from "@/lib/validation/project";

export async function POST(
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

  const { id } = routeParams.data;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (
    !project ||
    project.status !== "published" ||
    !isPublicModerationStatus(project.moderation_status)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // One view per authenticated user — the SECURITY DEFINER RPC dedupes via the
  // project_views table and bumps the denormalized counter. Anonymous viewers
  // are not counted (the RPC just echoes the current total for them).
  const { data: viewsCount, error } = await supabase.rpc(
    "record_project_view",
    { p_project_id: id },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ viewsCount: viewsCount ?? null });
}
