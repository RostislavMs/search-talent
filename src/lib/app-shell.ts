import { unstable_noStore as noStore } from "next/cache";
import { getCookieConsentFromCookies } from "@/lib/cookie-consent-server";
import {
  allowsCookieCategory,
  type CookieConsent,
} from "@/lib/cookie-consent";
import { hasCompanyMembership } from "@/lib/db/companies";
import { getActivePopup, type ActivePopup } from "@/lib/db/popups";
import { ensureProfileForUser } from "@/lib/db/profile";
import { getSectionVisibility } from "@/lib/db/section-visibility";
import type { SectionVisibility } from "@/lib/section-visibility";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getThemeFromCookies, type Theme } from "@/lib/theme";

export type AppViewer = {
  displayName: string | null;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  /** In a company team: the profile menu then links to /my-space/companies. */
  hasCompanies: boolean;
} | null;

/**
 * Only lets through avatar hosts that next.config.ts allows for the image
 * optimizer — an unlisted host would throw at render time. Shared with the
 * feedback page, which shows the same viewer identity strip.
 */
export function normalizeViewerAvatarUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
    ]);
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;

    if (supabaseHost) {
      allowedHosts.add(supabaseHost);
    }

    // Uploaded avatars live on Cloudflare R2 (see lib/storage/r2). The public
    // host comes from R2_PUBLIC_BASE_URL — without it here, freshly uploaded
    // avatars are silently rejected and the header falls back to the initial.
    const r2Host = process.env.R2_PUBLIC_BASE_URL
      ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname
      : null;

    if (r2Host) {
      allowedHosts.add(r2Host);
    }

    return allowedHosts.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getAppShellData(locale: Locale): Promise<{
  dictionary: Dictionary;
  initialConsent: CookieConsent | null;
  initialTheme: Theme;
  initialCanPersistTheme: boolean;
  isSignedIn: boolean;
  viewer: AppViewer;
  activePopup: ActivePopup | null;
  sections: SectionVisibility;
}> {
  noStore();

  const supabase = await createClient();
  const [{ data: auth }, initialConsent, initialTheme, activePopup, sections] =
    await Promise.all([
      supabase.auth.getUser(),
      getCookieConsentFromCookies(),
      getThemeFromCookies(),
      getActivePopup(supabase, locale),
      getSectionVisibility(),
    ]);

  const user = auth.user;

  let viewer: AppViewer = null;

  if (user) {
    const [profile, { data: adminRecord }, hasCompanies] = await Promise.all([
      ensureProfileForUser(supabase, user),
      supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      // False on any error, including before the companies migration runs.
      hasCompanyMembership(supabase, user.id),
      // Product metrics: last activity, for retention. The database only writes
      // when the stored value is over an hour old, and a failure (e.g. before the
      // migration) must not cost the page anything, so the result is ignored.
      supabase.rpc("touch_user_activity").then(
        () => null,
        () => null,
      ),
    ]);

    viewer = {
      displayName: profile?.name || null,
      email: user.email || null,
      username: profile?.username || null,
      avatarUrl: normalizeViewerAvatarUrl(profile?.avatar_url),
      isAdmin: Boolean(adminRecord),
      hasCompanies,
    };
  }

  return {
    dictionary: getDictionary(locale),
    initialConsent,
    initialTheme,
    initialCanPersistTheme: allowsCookieCategory(initialConsent, "preferences"),
    isSignedIn: Boolean(user),
    viewer,
    activePopup,
    sections,
  };
}
