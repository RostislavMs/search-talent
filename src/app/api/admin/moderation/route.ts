import { NextResponse } from "next/server";
import { emailModerationDecisions, moderateContent } from "@/lib/db/moderation-actions";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { moderationUpdateSchema } from "@/lib/validation/report";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/admin/moderation — a moderator's decision on reported content.
 * The database applies it with the report, logs it and notifies the owner
 * (moderate_content); the owner of a hidden profile, project, article or poll
 * also gets an e-mail from here.
 */
export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, moderationUpdateSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const note = payload.resolutionNote || null;
  const result = await moderateContent(context.supabase, {
    targetType: payload.targetType,
    targetIds: [payload.targetId],
    status: payload.moderationStatus,
    note,
    reportId: payload.reportId,
    reportStatus: payload.reportStatus,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 404 ? "Content not found" : result.error },
      { status: result.status },
    );
  }

  // Nothing to decide on and no report closed: the content is gone.
  if (result.items.length === 0 && !payload.reportId) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  await emailModerationDecisions({ targetType: payload.targetType, items: result.items, note });

  return NextResponse.json({ success: true });
}
