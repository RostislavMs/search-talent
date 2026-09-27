import { NextResponse } from "next/server";
import {
  buildLoginHref,
  getLocaleOfPath,
  resolvePostAuthPath,
  sanitizeNextPath,
} from "@/lib/auth/redirect";
import { getOnboardingRecord, needsOnboarding } from "@/lib/db/onboarding";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the password login form sends the browser once signed in. It applies
 * the same rule as the OAuth callback: the page from `next`, otherwise the
 * onboarding the first time and "My Space" after that.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const localeParam = requestUrl.searchParams.get("locale");
  const fallbackLocale: Locale =
    localeParam && isLocale(localeParam) ? localeParam : await getRequestLocale();
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"), fallbackLocale);
  const locale = getLocaleOfPath(next, fallbackLocale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildLoginHref(locale, next), requestUrl.origin));
  }

  const destination = resolvePostAuthPath({
    next,
    locale,
    needsOnboarding: next
      ? false
      : needsOnboarding(await getOnboardingRecord(supabase, user.id)),
  });

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
