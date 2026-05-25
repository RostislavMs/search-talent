import { unstable_noStore as noStore } from "next/cache";
import { getCookieConsentFromCookies } from "@/lib/cookie-consent-server";
import {
  allowsCookieCategory,
  type CookieConsent,
} from "@/lib/cookie-consent";
import { ensureProfileForUser } from "@/lib/db/profile";
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
} | null;

function normalizeViewerAvatarUrl(value: string | null | undefined) {
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
}> {
  noStore();

  const supabase = await createClient();
  const [{ data: auth }, initialConsent, initialTheme] = await Promise.all([
    supabase.auth.getUser(),
    getCookieConsentFromCookies(),
    getThemeFromCookies(),
  ]);

  const user = auth.user;

  let viewer: AppViewer = null;

  if (user) {
    const [profile, { data: adminRecord }] = await Promise.all([
      ensureProfileForUser(supabase, user),
      supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    viewer = {
      displayName: profile?.name || null,
      email: user.email || null,
      username: profile?.username || null,
      avatarUrl: normalizeViewerAvatarUrl(profile?.avatar_url),
      isAdmin: Boolean(adminRecord),
    };
  }

  return {
    dictionary: getDictionary(locale),
    initialConsent,
    initialTheme,
    initialCanPersistTheme: allowsCookieCategory(initialConsent, "preferences"),
    isSignedIn: Boolean(user),
    viewer,
  };
}
