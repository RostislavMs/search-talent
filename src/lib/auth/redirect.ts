import { isAuthRoute } from "@/lib/auth-routes";
import {
  createLocalePath,
  defaultLocale,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";

// Real in-app paths are far shorter; a longer value is junk or an attack.
const MAX_NEXT_LENGTH = 512;
// Resolving against a fixed fake origin tells us whether the value would leave
// the site: anything absolute or protocol-relative changes the origin.
const PLACEHOLDER_ORIGIN = "https://next.invalid";

/**
 * Validates a post-sign-in destination taken from a URL (`?next=`), so the
 * login and OAuth flows cannot be turned into an open redirect.
 *
 * Only same-site page paths pass. Dropped: anything that could leave the site
 * (`//evil.com`, `/\evil.com`, `https://…`, control characters), API routes,
 * and the auth screens themselves (sending someone back to /login after they
 * logged in would loop). A path without a locale gets `locale` in front.
 */
export function sanitizeNextPath(
  raw: unknown,
  locale: Locale = defaultLocale,
): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();

  if (
    !value ||
    value.length > MAX_NEXT_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== PLACEHOLDER_ORIGIN) {
    return null;
  }

  // `URL` has already collapsed dot segments, so `/uk/../api/x` is checked as
  // `/api/x` here.
  const { pathname } = url;

  if (pathname === "/api" || pathname.startsWith("/api/") || isAuthRoute(pathname)) {
    return null;
  }

  return `${createLocalePath(locale, pathname)}${url.search}${url.hash}`;
}

/** Locale of a sanitized path, or the fallback when it carries none. */
export function getLocaleOfPath(path: string | null, fallback: Locale): Locale {
  if (!path) {
    return fallback;
  }

  const [, maybeLocale] = path.split("/");
  return maybeLocale && isLocale(maybeLocale) ? maybeLocale : fallback;
}

/**
 * Where a person lands right after signing in: the page they were heading to,
 * otherwise the onboarding (first time) or their space.
 */
export function resolvePostAuthPath(input: {
  next: string | null;
  locale: Locale;
  needsOnboarding: boolean;
}) {
  if (input.next) {
    return input.next;
  }

  return createLocalePath(
    input.locale,
    input.needsOnboarding ? "/onboarding" : "/my-space",
  );
}

/** `/uk/login`, plus `?next=` when there is somewhere valid to come back to. */
export function buildLoginHref(locale: Locale, next?: string | null) {
  const loginPath = createLocalePath(locale, "/login");
  const safeNext = sanitizeNextPath(next, locale);

  return safeNext ? `${loginPath}?next=${encodeURIComponent(safeNext)}` : loginPath;
}

/** Same as `buildLoginHref`, for the sign-up screen. */
export function buildSignupHref(locale: Locale, next?: string | null) {
  const signupPath = createLocalePath(locale, "/signup");
  const safeNext = sanitizeNextPath(next, locale);

  return safeNext ? `${signupPath}?next=${encodeURIComponent(safeNext)}` : signupPath;
}

/**
 * Where the password login form sends the browser once signed in; the route
 * picks the final destination (see `resolvePostAuthPath`).
 */
export function buildContinueHref(locale: Locale, next?: string | null) {
  const params = new URLSearchParams({ locale });
  const safeNext = sanitizeNextPath(next, locale);

  if (safeNext) {
    params.set("next", safeNext);
  }

  return `/api/auth/continue?${params.toString()}`;
}

export type AuthCallbackFlow = "signup" | "recovery";

/**
 * The URL Supabase sends people back to after OAuth or the confirmation email.
 * `/api/auth/callback` finishes the sign-in and redirects on from there.
 */
export function buildAuthCallbackUrl(
  baseUrl: string,
  options: { next?: string | null; flow?: AuthCallbackFlow; locale?: Locale } = {},
) {
  const url = new URL("/api/auth/callback", baseUrl);

  if (options.next) {
    url.searchParams.set("next", options.next);
  }

  if (options.flow) {
    url.searchParams.set("flow", options.flow);
  }

  if (options.locale) {
    url.searchParams.set("locale", options.locale);
  }

  return url.toString();
}
