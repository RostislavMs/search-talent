import { NextResponse } from "next/server";
import { turnOffMessageEmails } from "@/lib/db/messages";
import { isValidMessageEmailUnsubscribeToken } from "@/lib/message-email-token";
import { rateLimit } from "@/lib/rate-limit";
import { messageEmailUnsubscribeSchema } from "@/lib/validation/messages";

/**
 * POST /api/messages/email-unsubscribe?u=…&t=… — turns the message emails off
 * without signing in, as mail services do from their own "Unsubscribe" button
 * (RFC 8058: a form body "List-Unsubscribe=One-Click", the token in the
 * address). The messages themselves keep arriving on the site.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const parsed = messageEmailUnsubscribeSchema.safeParse({
    u: url.searchParams.get("u") ?? undefined,
    t: url.searchParams.get("t") ?? undefined,
  });

  if (!parsed.success || !isValidMessageEmailUnsubscribeToken(parsed.data.u, parsed.data.t)) {
    return NextResponse.json({ error: "Invalid link", code: "invalid" }, { status: 400 });
  }

  // The token already proves the link; this only stops a loop hammering it.
  const limited = rateLimit(`messages-unsubscribe:${parsed.data.u}`, 10, 60_000);
  if (limited) {
    return limited;
  }

  const done = await turnOffMessageEmails(parsed.data.u);

  if (!done) {
    return NextResponse.json({ error: "Unavailable", code: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
