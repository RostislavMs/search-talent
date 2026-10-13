import { NextResponse } from "next/server";
import { getMessageAttachmentAccess } from "@/lib/db/message-attachments";
import { redirectToStoredAttachment } from "@/lib/message-attachments-server";
import { rateLimit } from "@/lib/rate-limit";
import { isPrivateStorageConfigured } from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { routeMessageIdSchema } from "@/lib/validation/messages";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/messages/attachments/:id[?download=1] — opens a file in a message.
 * message_attachment_access() checks that the caller sees its message right
 * now; the answer is a redirect to a link into the private bucket that lives
 * five minutes. Anyone else gets 404, whether or not the file exists.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const route = routeMessageIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isPrivateStorageConfigured()) {
    return NextResponse.json({ error: "Files are not available" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A conversation full of images asks for each of them.
  const limited = rateLimit(`messages-file:${user.id}`, 300, 60_000);
  if (limited) {
    return limited;
  }

  const stored = await getMessageAttachmentAccess(supabase, route.data.id);

  if (!stored) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return redirectToStoredAttachment(stored, new URL(request.url).searchParams.get("download") === "1");
}
