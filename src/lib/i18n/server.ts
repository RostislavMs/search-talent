import "server-only";

import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName, type Locale } from "@/lib/i18n/config";

/**
 * Resolve the viewer's locale inside an API route / server action.
 *
 * `/api/*` routes are not under the `/[locale]` segment, so the path carries no
 * locale. The middleware (see proxy.ts) keeps the `locale` cookie in sync with
 * the user's chosen language on every request, so we read it here and fall back
 * to the default when it is missing or invalid.
 */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(localeCookieName)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}
