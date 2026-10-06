import { NextResponse } from "next/server";
import { z } from "zod";
import { moderateContent } from "@/lib/db/moderation-actions";
import {
  REPORT_TARGETS,
  bulkModerationTargetTypes,
  moderationStatuses,
} from "@/lib/moderation";
import { getCurrentViewerRole } from "@/lib/moderation-server";

// Company pages and vacancies are moderated one by one (their teams and
// authors are told about each decision), so they are not offered here.
const bulkSchema = z.object({
  targetType: z.enum(bulkModerationTargetTypes),
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(["status_update", "delete"]),
  moderationStatus: z.enum(moderationStatuses).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();
  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bulkSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }

  const { targetType, ids, action, moderationStatus, note } = parsed.data;
  const { supabase } = context;
  const table = REPORT_TARGETS[targetType].table;

  if (action === "delete") {
    if (targetType === "profile") {
      return NextResponse.json(
        { error: "Bulk profile deletion is not supported" },
        { status: 400 },
      );
    }
    const { error } = await supabase.from(table).delete().in("id", ids);
    if (error) {
      return NextResponse.json(
        { error: error.message || "Bulk delete failed" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, affected: ids.length });
  }

  if (!moderationStatus) {
    return NextResponse.json(
      { error: "moderationStatus is required for status_update" },
      { status: 400 },
    );
  }

  // One call: the database moves every row, logs each decision and notifies
  // the owners in the app. No e-mails from a bulk action: up to 100 of them
  // would not fit in one request.
  const result = await moderateContent(supabase, {
    targetType,
    targetIds: ids,
    status: moderationStatus,
    note: note || null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Bulk update failed" },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, affected: result.items.length });
}
