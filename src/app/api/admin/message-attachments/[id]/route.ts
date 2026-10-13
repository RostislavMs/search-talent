import { NextResponse } from "next/server";
import { getReportedAttachment } from "@/lib/db/message-attachments";
import { redirectToStoredAttachment } from "@/lib/message-attachments-server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { isPrivateStorageConfigured } from "@/lib/storage/r2";
import { adminAttachmentQuerySchema, routeMessageIdSchema } from "@/lib/validation/messages";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/message-attachments/:id?report= — a moderator opens a file
 * from the report whose snapshot holds it. Moderators never read
 * conversations; this is the only way in, and the database writes every
 * opening to the audit log.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const route = routeMessageIdSchema.safeParse(await params);
  const query = adminAttachmentQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!route.success || !query.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isPrivateStorageConfigured()) {
    return NextResponse.json({ error: "Files are not available" }, { status: 503 });
  }

  const stored = await getReportedAttachment(context.supabase, query.data.report, route.data.id);

  if (stored === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!stored) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return redirectToStoredAttachment(stored, false);
}
