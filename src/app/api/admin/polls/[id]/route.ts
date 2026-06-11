import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { deleteStorageObject } from "@/lib/storage/provider";
import {
  pollModerationPayloadSchema,
  routePollIdSchema,
} from "@/lib/validation/polls";
import { parseJsonRequest } from "@/lib/validation/request";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routePollIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid poll id" },
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

  const parsed = await parseJsonRequest(request, pollModerationPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = routeParams.data;
  const { data: poll } = await context.supabase
    .from("polls")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const { error } = await context.supabase
    .from("polls")
    .update({
      moderation_status: parsed.data.moderation_status,
      moderation_note: parsed.data.moderation_note,
      moderated_at: new Date().toISOString(),
      moderated_by: context.user.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not update poll moderation" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routePollIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid poll id" },
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
  const { data: poll, error: pollError } = await context.supabase
    .from("polls")
    .select("id, cover_image_url, cover_image_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (pollError) {
    return NextResponse.json({ error: pollError.message }, { status: 400 });
  }

  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const { error: deleteError } = await context.supabase
    .from("polls")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Could not delete poll" },
      { status: 400 },
    );
  }

  if (poll.cover_image_storage_path?.trim() && poll.cover_image_url) {
    const { error: storageError } = await deleteStorageObject({
      supabase: context.supabase,
      bucket: "project-media",
      url: poll.cover_image_url,
      storagePath: poll.cover_image_storage_path.trim(),
    });

    if (storageError) {
      return NextResponse.json({ success: true, cleanupWarning: storageError.message });
    }
  }

  return NextResponse.json({ success: true });
}
