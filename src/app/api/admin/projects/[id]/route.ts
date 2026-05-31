import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { deleteStorageObject } from "@/lib/storage/provider";
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

  const { data: mediaItems, error: mediaError } = await context.supabase
    .from("project_media")
    .select("url, storage_path")
    .eq("project_id", project.id);

  if (mediaError) {
    return NextResponse.json({ error: mediaError.message }, { status: 400 });
  }

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

  const itemsToClean = (mediaItems || [])
    .map(
      (item) =>
        item as { url: string | null; storage_path: string | null },
    )
    .filter(
      (item): item is { url: string; storage_path: string } =>
        Boolean(item.storage_path && item.url),
    );

  const cleanupWarnings: string[] = [];
  for (const item of itemsToClean) {
    const { error: storageError } = await deleteStorageObject({
      supabase: context.supabase,
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
