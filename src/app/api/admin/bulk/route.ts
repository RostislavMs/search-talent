import { NextResponse } from "next/server";
import { z } from "zod";
import {
  REPORT_TARGETS,
  bulkModerationTargetTypes,
  getModerationActionType,
  moderationStatuses,
  normalizeModerationStatus,
  reportTargetColumns,
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
  const { supabase, user } = context;
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

  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id, moderation_status")
    .in("id", ids);

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message || "Bulk fetch failed" },
      { status: 400 },
    );
  }

  const rows = (existing || []) as { id: string; moderation_status: string | null }[];
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from(table)
    .update({
      moderation_status: moderationStatus,
      moderation_note: note || null,
      moderated_at: now,
      moderated_by: user.id,
    })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Bulk update failed" },
      { status: 400 },
    );
  }

  const actionRows = rows.map((row) => {
    const previous = normalizeModerationStatus(row.moderation_status);
    return {
      actor_user_id: user.id,
      report_id: null,
      target_type: targetType,
      ...reportTargetColumns(targetType, row.id),
      previous_status: previous,
      next_status: moderationStatus,
      report_status: null,
      action_type: getModerationActionType(previous, moderationStatus),
      note: note || null,
    };
  });

  if (actionRows.length > 0) {
    await supabase.from("moderation_actions").insert(actionRows);
  }

  return NextResponse.json({ success: true, affected: rows.length });
}
