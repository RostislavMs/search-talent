import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GITHUB_OAUTH_STATE_COOKIE,
} from "@/lib/constants/github";
import {
  exchangeCodeForToken,
  fetchAuthenticatedUser,
} from "@/lib/integrations/github";
import { upsertIntegration } from "@/lib/db/github-integrations";
import { createClient } from "@/lib/supabase/server";
import { createLocalePath, defaultLocale, isLocale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo";

function redirectWithStatus(
  base: string,
  returnTo: string,
  locale: string,
  status: "success" | "error",
  message?: string,
) {
  const safeReturnTo = returnTo.startsWith("/") ? returnTo : "/profile/edit";
  const target = new URL(
    createLocalePath(isLocale(locale) ? locale : defaultLocale, safeReturnTo),
    base,
  );
  target.searchParams.set("github", status);
  if (message) target.searchParams.set("message", message);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const siteBase = getSiteUrl();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateFromQuery = url.searchParams.get("state");

  const cookieStore = await cookies();
  const stored = cookieStore.get(GITHUB_OAUTH_STATE_COOKIE);
  cookieStore.delete(GITHUB_OAUTH_STATE_COOKIE);

  let returnTo = "/profile/edit";
  let locale = defaultLocale as string;
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
      // ignore corrupt cookie; treated as state mismatch below.
    }
  }

  if (!code || !stateFromQuery || stateFromQuery !== expectedState) {
    return redirectWithStatus(siteBase, returnTo, locale, "error", "state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectWithStatus(siteBase, returnTo, locale, "error", "auth");
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithStatus(siteBase, returnTo, locale, "error", "config");
  }

  const redirectUri = `${siteBase.replace(/\/$/, "")}/api/integrations/github/callback`;

  const tokenResponse = await exchangeCodeForToken({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });

  if (!tokenResponse) {
    return redirectWithStatus(siteBase, returnTo, locale, "error", "token");
  }

  const githubUser = await fetchAuthenticatedUser(tokenResponse.accessToken);
  if (!githubUser) {
    return redirectWithStatus(siteBase, returnTo, locale, "error", "github");
  }

  const ok = await upsertIntegration(supabase, {
    userId: user.id,
    githubUserId: githubUser.id,
    githubLogin: githubUser.login,
    githubAvatarUrl: githubUser.avatarUrl,
    accessToken: tokenResponse.accessToken,
    tokenType: tokenResponse.tokenType,
    scopes: tokenResponse.scopes,
  });

  if (!ok) {
    return redirectWithStatus(siteBase, returnTo, locale, "error", "store");
  }

  return redirectWithStatus(siteBase, returnTo, locale, "success");
}
