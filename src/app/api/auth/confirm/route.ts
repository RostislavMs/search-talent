import { NextResponse } from "next/server";
import { createLocalePath, isLocale, type Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/confirm?token_hash=…&locale=… — the link in the sign-up
 * confirmation email (supabase/email-templates/confirm-signup.html).
 *
 * The token is verified on the server, so the person is signed in on whatever
 * device opened the email, and lands on the onboarding. The token type is
 * fixed rather than read from the URL, and there is no branch on the query
 * string: Supabase checks the token, and a missing or forged one simply fails
 * and shows the "link no longer works" screen.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const localeParam = requestUrl.searchParams.get("locale");
  const locale: Locale =
    localeParam && isLocale(localeParam) ? localeParam : await getRequestLocale();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: requestUrl.searchParams.get("token_hash") ?? "",
  });

  const destination =
    !error && data.user
      ? createLocalePath(locale, "/onboarding")
      : `${createLocalePath(locale, "/verify")}?status=expired`;

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
