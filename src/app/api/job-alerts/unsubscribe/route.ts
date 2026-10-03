import { NextResponse } from "next/server";
import { turnOffJobAlertEmails } from "@/lib/db/job-alerts";
import { isValidJobAlertUnsubscribeToken } from "@/lib/job-alert-token";
import { rateLimit } from "@/lib/rate-limit";
import { jobAlertUnsubscribeSchema } from "@/lib/validation/job-alerts";

/**
 * POST /api/job-alerts/unsubscribe?u=…&t=… — turns the job alert emails off
 * without signing in. Mail services call it on their own "Unsubscribe" button
 * (RFC 8058: a form body "List-Unsubscribe=One-Click", the token in the
 * address); the page behind the link in the email sends {u, t} as JSON.
 * The alerts stay and keep notifying on the site.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let candidate: Record<string, unknown> = {
    u: url.searchParams.get("u") ?? undefined,
    t: url.searchParams.get("t") ?? undefined,
  };

  if (!candidate.u || !candidate.t) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object") {
      candidate = body as Record<string, unknown>;
    }
  }

  const parsed = jobAlertUnsubscribeSchema.safeParse(candidate);

  if (!parsed.success || !isValidJobAlertUnsubscribeToken(parsed.data.u, parsed.data.t)) {
    return NextResponse.json({ error: "Invalid link", code: "invalid" }, { status: 400 });
  }

  // The token already proves the link; this only stops a loop hammering it.
  const limited = rateLimit(`job-alerts-unsubscribe:${parsed.data.u}`, 10, 60_000);
  if (limited) {
    return limited;
  }

  const done = await turnOffJobAlertEmails(parsed.data.u);

  if (!done) {
    return NextResponse.json({ error: "Unavailable", code: "unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
