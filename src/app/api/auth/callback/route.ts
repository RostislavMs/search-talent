import { NextResponse } from "next/server";
import {
  buildLoginHref,
  getLocaleOfPath,
  resolvePostAuthPath,
  sanitizeNextPath,
} from "@/lib/auth/redirect";
import { getOnboardingRecord, needsOnboarding } from "@/lib/db/onboarding";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Finishes a sign-in that happened outside the site and redirects on. OAuth
 * (Google, GitHub) and the old-style confirmation link opened in the same
 * browser come back here with `?code=` (PKCE). The current confirmation email
 * links to /api/auth/confirm instead, which works on any device.
 *
 * With `next` the person goes where they were heading; otherwise to the
 * onboarding the first time and to their space after that. When the session
 * cannot be created, a new account is told its email is confirmed and asked to
 * log in (the email itself is confirmed by then), others go back to login.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const params = requestUrl.searchParams;
  const localeParam = params.get("locale");
  const fallbackLocale: Locale =
    localeParam && isLocale(localeParam) ? localeParam : await getRequestLocale();
  const isSignup = params.get("flow") === "signup";
  // A new account always starts with the onboarding, even before the
  // onboarding table exists to tell new and old accounts apart.
  const next =
    sanitizeNextPath(params.get("next"), fallbackLocale) ??
    (isSignup ? createLocalePath(fallbackLocale, "/onboarding") : null);
  const locale = getLocaleOfPath(next, fallbackLocale);

  const code = params.get("code");

  const supabase = await createClient();
  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    userId = error ? null : (data.user?.id ?? null);
  }

  if (!userId) {
    // A `code` that fails to exchange means the email link was opened in
    // another browser: Supabase has confirmed the email already, only the
    // session is missing. Anything else is an expired or broken link.
    const signupStatus = code && !params.get("error") ? "confirmed" : "expired";
    // Both addresses are built up front; `flow` from the URL only picks which
    // screen explains the failure.
    const verifyPath = `${createLocalePath(locale, "/verify")}?status=${signupStatus}`;
    const loginRetryPath = `${buildLoginHref(locale, next)}${next ? "&" : "?"}error=oauth`;

    return NextResponse.redirect(
      new URL(isSignup ? verifyPath : loginRetryPath, requestUrl.origin),
    );
  }

  const destination = resolvePostAuthPath({
    next,
    locale,
    needsOnboarding: next
      ? false
      : needsOnboarding(await getOnboardingRecord(supabase, userId)),
  });

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
