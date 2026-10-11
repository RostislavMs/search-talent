import { after, NextResponse } from "next/server";
import { listConversationMessages, scheduleMessageEmails, sendMessage } from "@/lib/db/messages";
import { refusalHttpStatus } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  messagesPageQuerySchema,
  routeConversationIdSchema,
  sendMessageSchema,
} from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/messages/conversations/:id/messages?before= | ?after= — older
 * messages while scrolling up, or everything new after a reconnect.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const route = routeConversationIdSchema.safeParse(await params);
  const query = messagesPageQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!route.success || !query.success) {
    return NextResponse.json({ error: "Invalid request", code: "invalid" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const messages = await listConversationMessages(supabase, route.data.id, {
    before: query.data.before ?? null,
    after: query.data.after ?? null,
  });

  return NextResponse.json({ messages });
}

/**
 * POST /api/messages/conversations/:id/messages — a message in an existing
 * conversation. send_message() checks the side, blocks, the request rules,
 * the limits and the text; `clientId` makes a retry safe.
 */
export async function POST(request: Request, { params }: RouteContext) {
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

  // The database allows 20 a minute; this only stops a loop hammering it.
  const limited = rateLimit(`messages-send:${user.id}`, 40, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, sendMessageSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const outcome = await sendMessage(supabase, route.data.id, parsed.data.body, parsed.data.clientId ?? null);

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
    scam: outcome.scam,
  });
}
