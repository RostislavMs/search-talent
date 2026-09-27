import { NextResponse } from "next/server";
import { allowsCookieCategory } from "@/lib/cookie-consent";
import { getCookieConsentFromCookies } from "@/lib/cookie-consent-server";
import { signupSourceSchema } from "@/lib/first-touch";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/metrics/signup-source — stores where a new account's first visit
 * came from, once (see lib/first-touch and components/first-touch-tracker).
 *
 * The consent cookie is checked here as well as in the browser, so a request
 * without analytics consent is dropped even if the client misbehaves. The RPC
 * keeps only a first touch that predates the account, reported within a week
 * of sign-up, and never overwrites an earlier value.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = signupSourceSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sign-up source" }, { status: 400 });
  }

  const consent = await getCookieConsentFromCookies();
  if (!allowsCookieCategory(consent, "analytics")) {
    return NextResponse.json({ recorded: false });
  }

  const { data, error } = await supabase.rpc("record_signup_source", {
    p_referrer_host: parsed.data.referrerHost,
    p_utm_source: parsed.data.utmSource,
    p_utm_medium: parsed.data.utmMedium,
    p_utm_campaign: parsed.data.utmCampaign,
    p_landing_path: parsed.data.landingPath,
    p_first_seen_age_seconds: parsed.data.firstSeenAgeSeconds,
  });

  if (error) {
    console.warn("[metrics/signup-source] not recorded:", error.message);
    return NextResponse.json({ recorded: false });
  }

  return NextResponse.json({ recorded: data === true });
}
