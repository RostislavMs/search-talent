import { NextResponse } from "next/server";
import { discardMessageAttachment, verifyMessageAttachment } from "@/lib/db/message-attachments";
import { refusalHttpStatus } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { isPrivateStorageConfigured } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { routeAttachmentSchema } from "@/lib/validation/messages";

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

async function signedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * POST /api/messages/conversations/:id/attachments/:attachmentId — the
 * upload finished. The stored object is read back (its size and first bytes)
 * and the database accepts the file only when both match what was declared;
 * only then can it go out with a message.
 */
export async function POST(_request: Request, { params }: RouteContext) {
  const route = routeAttachmentSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid id", code: "invalid" }, { status: 400 });
  }

  if (!isPrivateStorageConfigured()) {
    return NextResponse.json({ error: "Files are not available", code: "storage_unavailable" }, { status: 503 });
  }

  const { user } = await signedInUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`messages-attach-check:${user.id}`, 60, 60_000);
  if (limited) {
    return limited;
  }

  const verified = await verifyMessageAttachment(user.id, route.data.id, route.data.attachmentId);

  if (!verified.ok) {
    return NextResponse.json(
      { error: "The file was not accepted", code: verified.code },
      { status: refusalHttpStatus(verified.code) },
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/messages/conversations/:id/attachments/:attachmentId — the
 * sender took an unsent file out of the message.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const route = routeAttachmentSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid id", code: "invalid" }, { status: 400 });
  }

  const { supabase, user } = await signedInUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const discarded = await discardMessageAttachment(supabase, route.data.id, route.data.attachmentId);

  if (!discarded) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
