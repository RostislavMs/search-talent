import { NextResponse } from "next/server";
import { removeMessageBlock } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";
import { routeConversationIdSchema } from "@/lib/validation/messages";

/**
 * DELETE /api/messages/blocks/:id — unblock: one's own block, or one a
 * company the caller is in made. Anyone else's: 404.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeConversationIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid id", code: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const removed = await removeMessageBlock(supabase, route.data.id);

  if (!removed) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
