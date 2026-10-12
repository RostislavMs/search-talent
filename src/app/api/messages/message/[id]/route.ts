import { after, NextResponse } from "next/server";
import { cancelMessageEmails, deleteMessage, editMessage, getConversationMessage } from "@/lib/db/messages";
import { refusalHttpStatus } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { editMessageSchema, routeMessageIdSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

type RouteContext = { params: Promise<{ id: string }> };

async function signedIn(params: RouteContext["params"]) {
  const route = routeMessageIdSchema.safeParse(await params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { route, supabase, user };
}

/**
 * GET /api/messages/message/:id — one message, for the live update: Realtime
 * only says "message X in conversation Y", the text comes from here, checked
 * against the caller's side like every other read.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { route, supabase, user } = await signedIn(params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid message id", code: "invalid" }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const message = await getConversationMessage(supabase, route.data.id);

  if (!message) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ message });
}

/**
 * PATCH /api/messages/message/:id {body} — a new text for one's own message.
 * edit_message() allows it within 15 minutes, up to 10 times, through the
 * same checks as a new message. Answers with the message as it now reads.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { route, supabase, user } = await signedIn(params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid message id", code: "invalid" }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  // The database caps edits per message; this only stops a loop hammering it.
  const limited = rateLimit(`messages-edit:${user.id}`, 30, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, editMessageSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const outcome = await editMessage(supabase, route.data.id, parsed.data.body);

  if (!outcome.ok) {
    return NextResponse.json(
      { error: "The message was not changed", code: outcome.code, categories: outcome.categories },
      { status: refusalHttpStatus(outcome.code) },
    );
  }

  return NextResponse.json({ changed: outcome.changed, message: await getConversationMessage(supabase, route.data.id) });
}

/**
 * DELETE /api/messages/message/:id — deletes one's own message: both sides
 * see "Message deleted". An email that was only about it is cancelled.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { route, supabase, user } = await signedIn(params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid message id", code: "invalid" }, { status: 400 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const outcome = await deleteMessage(supabase, route.data.id);

  if (!outcome.ok) {
    const status = outcome.code === "failed" ? 500 : outcome.code === "unauthorized" ? 401 : 404;
    return NextResponse.json({ error: "The message was not deleted", code: outcome.code }, { status });
  }

  if (outcome.cancelEmailIds.length > 0) {
    after(() => cancelMessageEmails(outcome.cancelEmailIds));
  }

  return NextResponse.json({ changed: outcome.changed, message: await getConversationMessage(supabase, route.data.id) });
}
