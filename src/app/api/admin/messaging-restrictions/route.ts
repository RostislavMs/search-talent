import { NextResponse } from "next/server";
import { setMessagingRestriction } from "@/lib/db/messages";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { messagingRestrictionSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/admin/messaging-restrictions — a moderator limits someone's
 * messaging (new conversations only, or all messages; for some days or until
 * lifted) or lifts the limit (`scope: null`). With `reportId` the report it
 * answers is closed. The database checks the role and logs the decision.
 */
export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, messagingRestrictionSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await setMessagingRestriction(context.supabase, {
    userId: parsed.data.userId,
    scope: parsed.data.scope,
    days: parsed.data.days ?? null,
    note: parsed.data.note || null,
    reportId: parsed.data.reportId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
