import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildVisitorSeed,
  classifyReferrer,
  getClientIp,
  hostFromUrl,
  isLikelyBot,
  viewBeaconSchema,
} from "@/lib/view-tracking";

/**
 * POST /api/metrics/view — one portfolio page view for the product metrics.
 *
 * Fire-and-forget from the browser (see components/view-beacon), so every
 * outcome that is not a malformed request answers 204 with no body: a skipped
 * bot, a repeat view the same day, a hidden page or a missing service key all
 * look the same from outside.
 *
 * The visitor seed (IP + user agent, or the account id) is hashed with the
 * day's salt inside the database and never stored; see
 * database/2026-09-26-product-metrics.sql.
 */

// A person opens a handful of pages a minute; the cap only stops a script from
// inflating someone's views from one address.
const RATE_LIMIT = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

let warnedAboutRpc = false;

function noContent() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const limited = rateLimit(
    `metrics-view:${ip || "unknown"}`,
    RATE_LIMIT,
    RATE_LIMIT_WINDOW_MS,
  );
  if (limited) {
    return limited;
  }

  const body = await request.json().catch(() => null);
  const parsed = viewBeaconSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid view payload" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");
  if (isLikelyBot(userAgent)) {
    return noContent();
  }

  const admin = createAdminClient();
  if (!admin) {
    return noContent();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { source, referrerHost } = classifyReferrer(parsed.data.referrer, [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
    hostFromUrl(getSiteUrl()),
  ]);

  const { error } = await admin.rpc("record_content_view", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_visitor_seed: buildVisitorSeed({ userId: user?.id ?? null, ip, userAgent }),
    p_viewer_user_id: user?.id ?? null,
    p_source: source,
    p_referrer_host: referrerHost,
  });

  if (error && !warnedAboutRpc) {
    // Most likely the migration is not applied yet. Metrics must never break
    // a page, so this stays one log line per instance.
    warnedAboutRpc = true;
    console.warn("[metrics/view] not recorded:", error.message);
  }

  return noContent();
}
