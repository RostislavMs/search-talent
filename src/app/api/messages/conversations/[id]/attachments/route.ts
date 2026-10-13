import { NextResponse } from "next/server";
import { createMessageAttachment } from "@/lib/db/message-attachments";
import { refusalHttpStatus } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createPrivateUploadUrl, isPrivateStorageConfigured } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { createAttachmentSchema, routeConversationIdSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/messages/conversations/:id/attachments — a file about to be
 * uploaded into the conversation. create_message_attachment() checks the
 * conversation (open, the caller may write), the type, the size and the
 * limits; the answer is a signed PUT into the private bucket for exactly
 * this type and size, valid for five minutes.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const route = routeConversationIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid conversation id", code: "invalid" }, { status: 400 });
  }

  if (!isPrivateStorageConfigured()) {
    return NextResponse.json({ error: "Files are not available", code: "storage_unavailable" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  // The database allows 30 a day; this only stops a loop hammering it.
  const limited = rateLimit(`messages-attach:${user.id}`, 30, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, createAttachmentSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const created = await createMessageAttachment(supabase, route.data.id, parsed.data);

  if (!created.ok) {
    return NextResponse.json(
      { error: "The file cannot be added", code: created.code },
      { status: refusalHttpStatus(created.code) },
    );
  }

  let uploadUrl: string;
  try {
    uploadUrl = await createPrivateUploadUrl({
      key: created.storageKey,
      contentType: parsed.data.contentType,
      contentLength: parsed.data.size,
    });
  } catch (error) {
    console.error("[messages] signing an upload failed", error);
    return NextResponse.json({ error: "Files are not available", code: "storage_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ attachmentId: created.attachmentId, uploadUrl });
}
