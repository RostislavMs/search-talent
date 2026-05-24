import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GITHUB_AUTHORIZE_URL,
  GITHUB_OAUTH_SCOPE_STRING,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_OAUTH_STATE_TTL_SECONDS,
} from "@/lib/constants/github";
import { createClient } from "@/lib/supabase/server";
import { createLocalePath, defaultLocale, isLocale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo";

/**
 * GET /api/integrations/github/start
 *
 * Initiates the GitHub OAuth flow. Generates a CSRF-safe state, stores
 * it in a httpOnly cookie, and redirects the user to GitHub. The
 * `return_to` query param (relative path) is preserved across the
 * round-trip so we can land the user back on the same page.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  if (!user) {
    return NextResponse.redirect(
      new URL(createLocalePath(locale, "/login"), getSiteUrl()),
    );
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub integration is not configured." },
      { status: 503 },
    );
  }

  const returnTo = url.searchParams.get("return_to") || "/profile/edit";
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/profile/edit";

  const state = randomBytes(24).toString("base64url");
  const payload = JSON.stringify({ state, returnTo: safeReturnTo, locale });

  const cookieStore = await cookies();
  cookieStore.set(GITHUB_OAUTH_STATE_COOKIE, payload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GITHUB_OAUTH_STATE_TTL_SECONDS,
  });

  const redirectUri = `${getSiteUrl().replace(/\/$/, "")}/api/integrations/github/callback`;

  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", GITHUB_OAUTH_SCOPE_STRING);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");

  return NextResponse.redirect(authorize);
}
