import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  EMPTY_MESSAGE_ERROR,
  isEmptyMessageContent,
  popupCreateSchema,
  popupInputToRow,
} from "@/lib/validation/popup";
import { parseJsonRequest } from "@/lib/validation/request";

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, popupCreateSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { supabase } = context;

  // An active message popup must have something to show.
  if (
    parsed.data.isActive &&
    parsed.data.kind === "message" &&
    isEmptyMessageContent(parsed.data)
  ) {
    return NextResponse.json({ error: EMPTY_MESSAGE_ERROR }, { status: 400 });
  }

  // Only one popup may be active at a time. Deactivate any current active
  // popup before inserting a new active one so the single-active index holds.
  if (parsed.data.isActive) {
    const { error: deactivateError } = await supabase
      .from("site_popups")
      .update({ is_active: false })
      .eq("is_active", true);

    if (deactivateError) {
      return NextResponse.json(
        { error: deactivateError.message || "Could not update popups" },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("site_popups")
    .insert(popupInputToRow(parsed.data))
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not create popup" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, id: (data as { id: string }).id });
}
