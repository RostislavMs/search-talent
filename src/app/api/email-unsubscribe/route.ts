import { NextResponse } from "next/server";
import { turnOffEmails } from "@/lib/db/email-preferences";
import { isValidEmailUnsubscribeToken } from "@/lib/email-unsubscribe-token";
import { rateLimit } from "@/lib/rate-limit";
import { emailUnsubscribeSchema } from "@/lib/validation/messages";

/**
 * POST /api/email-unsubscribe?k=messages|followers&u=…&t=… — turns one kind
 * of email off without signing in, as mail services do from their own
 * "Unsubscribe" button (RFC 8058: a form body "List-Unsubscribe=One-Click",
 * the token in the address). Nothing else changes: the messages and
 * followers themselves stay on the site.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const parsed = emailUnsubscribeSchema.safeParse({
    k: url.searchParams.get("k") ?? undefined,
    u: url.searchParams.get("u") ?? undefined,
    t: url.searchParams.get("t") ?? undefined,
  });

  if (!parsed.success || !isValidEmailUnsubscribeToken(parsed.data.k, parsed.data.u, parsed.data.t)) {
    return NextResponse.json({ error: "Invalid link", code: "invalid" }, { status: 400 });
  }

  // The token already proves the link; this only stops a loop hammering it.
  const limited = rateLimit(`email-unsubscribe:${parsed.data.u}`, 10, 60_000);
  if (limited) {
    return limited;
  }

  const done = await turnOffEmails(parsed.data.k, parsed.data.u);

  if (!done) {
    return NextResponse.json({ error: "Unavailable", code: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
