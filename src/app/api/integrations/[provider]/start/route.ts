import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isProviderIntegrationId } from "@/lib/constants/provider-integrations";
import {
  getProviderAdapter,
  getProviderCredentials,
} from "@/lib/integrations/provider-registry";
import { createClient } from "@/lib/supabase/server";
import { createLocalePath, defaultLocale, isLocale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo";
import {
  PROVIDER_OAUTH_STATE_TTL_SECONDS,
  providerStateCookieName,
} from "../oauth-state";

/**
 * GET /api/integrations/:provider/start
 *
 * Starts the OAuth flow: mints a CSRF state, parks it in a httpOnly cookie
 * together with the page to return to, and redirects to the provider.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isProviderIntegrationId(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale =
    localeParam && isLocale(localeParam) ? localeParam : defaultLocale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(createLocalePath(locale, "/login"), getSiteUrl()),
    );
  }

  const credentials = getProviderCredentials(provider);

  if (!credentials) {
    return NextResponse.json(
      { error: `${provider} integration is not configured.` },
      { status: 503 },
    );
  }

  const returnTo = url.searchParams.get("return_to") || "/profile/edit";
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/profile/edit";
  const state = randomBytes(24).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set(
    providerStateCookieName(provider),
    JSON.stringify({ state, returnTo: safeReturnTo, locale }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PROVIDER_OAUTH_STATE_TTL_SECONDS,
    },
  );

  return NextResponse.redirect(
    getProviderAdapter(provider).buildAuthorizeUrl({
      clientId: credentials.clientId,
      redirectUri: credentials.redirectUri,
      state,
    }),
  );
}
