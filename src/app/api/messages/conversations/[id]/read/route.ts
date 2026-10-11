import { after, NextResponse } from "next/server";
import { cancelMessageEmails, markConversationRead } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";
import { markConversationReadSchema, routeConversationIdSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/messages/conversations/:id/read {seq?} — the conversation is on
 * screen and read up to `seq`. The page calls it only while the tab is
 * visible, never on a prefetch. Emails still waiting about what is now read
 * are cancelled at Resend.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeConversationIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid conversation id", code: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, markConversationReadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const result = await markConversationRead(supabase, route.data.id, parsed.data.seq);

  if (!result) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  if (result.cancelEmailIds.length > 0) {
    after(() => cancelMessageEmails(result.cancelEmailIds));
  }

  return NextResponse.json({ lastReadSeq: result.lastReadSeq });
}
