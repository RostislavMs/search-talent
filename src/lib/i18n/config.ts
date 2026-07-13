export const locales = ["uk", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "uk";

// The hreflang `x-default` target — deliberately NOT `defaultLocale`. The root
// redirect sends every visitor whose Accept-Language lacks Ukrainian to /en
// (see `detectPreferredLocale`), so English is the real fallback for unmatched
// languages. `x-default` must mirror that behaviour, otherwise Google sees a
// contradiction between what the sitemap declares and where the site sends users.
export const xDefaultLocale: Locale = "en";

export const localeCookieName = "locale";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocaleFromPathname(pathname: string | null): Locale {
  if (!pathname) {
    return defaultLocale;
  }

  const [, maybeLocale] = pathname.split("/");

  if (maybeLocale && isLocale(maybeLocale)) {
    return maybeLocale;
  }

  return defaultLocale;
}

export function stripLocaleFromPathname(pathname: string) {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];

  if (maybeLocale && isLocale(maybeLocale)) {
    const nextPath = `/${segments.slice(2).join("/")}`;
    return nextPath === "/" ? "/" : nextPath.replace(/\/$/, "") || "/";
  }

  return pathname || "/";
}

export function createLocalePath(locale: Locale, href: string) {
  if (!href || href === "/") {
    return `/${locale}`;
  }

  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    return href;
  }

  const normalizedHref = href.startsWith("/") ? href : `/${href}`;

  if (isLocale(normalizedHref.split("/")[1] || "")) {
    return normalizedHref;
  }

  return `/${locale}${normalizedHref === "/" ? "" : normalizedHref}`;
}

export function switchLocalePathname(pathname: string, locale: Locale) {
  return createLocalePath(locale, stripLocaleFromPathname(pathname));
}

export function detectPreferredLocale(
  acceptLanguageHeader: string | null,
): Locale {
  if (!acceptLanguageHeader) {
    return defaultLocale;
  }

  const normalized = acceptLanguageHeader.toLowerCase();

  if (normalized.includes("uk")) {
    return "uk";
  }

  return "en";
}
