import { NextResponse } from "next/server";
import {
  applyConversationAction,
  getConversationView,
  listConversationMessages,
} from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";
import { conversationActionSchema, routeConversationIdSchema } from "@/lib/validation/messages";
import { parseJsonRequest } from "@/lib/validation/request";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/messages/conversations/:id — the conversation's header and its
 * latest messages. Someone outside it gets 404, as if there were nothing.
 */
export async function GET(_request: Request, { params }: RouteContext) {
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

  const [conversation, messages] = await Promise.all([
    getConversationView(supabase, route.data.id),
    listConversationMessages(supabase, route.data.id),
  ]);

  if (!conversation) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ conversation, messages });
}

/**
 * PATCH /api/messages/conversations/:id — one action from the conversation's
 * menu: accept a request, archive, mute, clear ("delete for me"), block.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
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

  const parsed = await parseJsonRequest(request, conversationActionSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const result = await applyConversationAction(supabase, route.data.id, parsed.data);

  if (!result.ok) {
    const status = result.code === "failed" ? 500 : result.code === "not_recipient" ? 403 : 404;
    return NextResponse.json({ error: "The conversation was not changed", code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, deleted: result.deleted });
}
