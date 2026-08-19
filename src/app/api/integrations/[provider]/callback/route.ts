import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isProviderIntegrationId,
  type ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";
import { upsertProviderIntegration } from "@/lib/db/provider-integrations";
import {
  getProviderAdapter,
  getProviderCredentials,
} from "@/lib/integrations/provider-registry";
import { createClient } from "@/lib/supabase/server";
import { createLocalePath, defaultLocale, isLocale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo";
import { providerStateCookieName } from "../oauth-state";

/**
 * Lands the user back where they started with `?integration=<provider>` and
 * `?status=success|error`, mirroring the GitHub callback's contract so the
 * cards can report the outcome without extra round-trips.
 */
function redirectWithStatus(params: {
  base: string;
  provider: ProviderIntegrationId;
  returnTo: string;
  locale: string;
  status: "success" | "error";
  message?: string;
}) {
  const safeReturnTo = params.returnTo.startsWith("/")
    ? params.returnTo
    : "/profile/edit";
  const target = new URL(
    createLocalePath(
      isLocale(params.locale) ? params.locale : defaultLocale,
      safeReturnTo,
    ),
    params.base,
  );
  target.searchParams.set("integration", params.provider);
  target.searchParams.set("status", params.status);
  if (params.message) target.searchParams.set("message", params.message);
  return NextResponse.redirect(target);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isProviderIntegrationId(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const base = getSiteUrl();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateFromQuery = url.searchParams.get("state");

  const cookieStore = await cookies();
  const cookieName = providerStateCookieName(provider);
  const stored = cookieStore.get(cookieName);
  cookieStore.delete(cookieName);

  let returnTo = "/profile/edit";
  let locale: string = defaultLocale;
  let expectedState: string | null = null;

  if (stored?.value) {
    try {
      const parsed = JSON.parse(stored.value) as {
        state?: string;
        returnTo?: string;
        locale?: string;
      };
      expectedState = parsed.state ?? null;
      returnTo = parsed.returnTo || returnTo;
      locale = parsed.locale || locale;
    } catch {
      // Corrupt cookie is handled as a state mismatch below.
    }
  }

  const fail = (message: string) =>
    redirectWithStatus({
      base,
      provider,
      returnTo,
      locale,
      status: "error",
      message,
    });

  if (!code || !stateFromQuery || stateFromQuery !== expectedState) {
    return fail("state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("auth");

  const credentials = getProviderCredentials(provider);
  if (!credentials) return fail("config");

  const adapter = getProviderAdapter(provider);
  const token = await adapter.exchangeCodeForToken({
    code,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri,
  });

  if (!token) return fail("token");

  const account = await adapter.fetchAccount(token.accessToken);
  if (!account) return fail("account");

  const ok = await upsertProviderIntegration(supabase, {
    userId: user.id,
    provider,
    externalUserId: account.id,
    externalLogin: account.login,
    externalAvatarUrl: account.avatarUrl,
    token,
  });

  if (!ok) return fail("store");

  return redirectWithStatus({
    base,
    provider,
    returnTo,
    locale,
    status: "success",
  });
}
