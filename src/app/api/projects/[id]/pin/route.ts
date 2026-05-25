import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeProjectIdSchema } from "@/lib/validation/project";

async function authorize(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!project || project.owner_id !== user.id) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }

  return { supabase };
}

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
  const result = await authorize(id);

  if (result.error) {
    return result.error;
  }

  const { error } = await result.supabase.rpc("set_pinned_project", {
    target_project_id: id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not pin project" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, pinned: true });
}

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

  const { id } = routeParams.data;
  const result = await authorize(id);

  if (result.error) {
    return result.error;
  }

  const { error } = await result.supabase.rpc("unpin_project", {
    target_project_id: id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not unpin project" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, pinned: false });
}
