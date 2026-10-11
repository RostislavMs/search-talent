import { NextResponse } from "next/server";
import { getConversationMessage } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";
import { routeMessageIdSchema } from "@/lib/validation/messages";

/**
 * GET /api/messages/message/:id — one message, for the live update: Realtime
 * only says "message X in conversation Y", the text comes from here, checked
 * against the caller's side like every other read.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeMessageIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid message id", code: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const message = await getConversationMessage(supabase, route.data.id);

  if (!message) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ message });
}
