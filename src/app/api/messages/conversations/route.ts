import { after, NextResponse } from "next/server";
import { listConversations, scheduleMessageEmails, startConversation } from "@/lib/db/messages";
import { refusalHttpStatus } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { conversationsQuerySchema, startConversationSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * GET /api/messages/conversations?box=&company=&before= — the caller's
 * conversations (or a company's team inbox), newest first.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = conversationsQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", code: "invalid" }, { status: 400 });
  }

  const conversations = await listConversations(supabase, {
    box: parsed.data.box,
    companyId: parsed.data.company ?? null,
    before: parsed.data.before ?? null,
  });

  return NextResponse.json({ conversations });
}

/**
 * POST /api/messages/conversations — the first message to someone, as oneself
 * or as a company (`companyId`), maybe about an application. When the two
 * already talk, it simply goes into that conversation. start_conversation()
 * checks who may write to whom, the request rules, the limits and the text.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  // The database caps new conversations; this only stops a loop hammering it.
  const limited = rateLimit(`messages-start:${user.id}`, 20, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, startConversationSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const outcome = await startConversation(supabase, parsed.data);

  if (!outcome.ok) {
    return NextResponse.json(
      { error: "The message was not sent", code: outcome.code, categories: outcome.categories },
      { status: refusalHttpStatus(outcome.code) },
    );
  }

  if (!outcome.duplicate) {
    after(() => scheduleMessageEmails(outcome.messageId));
  }

  return NextResponse.json({
    conversationId: outcome.conversationId,
    messageId: outcome.messageId,
    seq: outcome.seq,
    created: outcome.created,
    scam: outcome.scam,
  });
}
