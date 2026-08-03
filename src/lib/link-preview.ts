/**
 * Hover previews for internal links — shared contract.
 *
 * The feature has two halves that must agree on exactly which URLs are
 * previewable: the client provider (which decides whether hovering a link
 * should fetch anything at all) and the API route (which must never resolve
 * an arbitrary path into a database read). Both import this module, so the
 * whitelist below is the single source of truth.
 *
 * Deliberately free of `server-only` and of any DB/Next import so the client
 * bundle can use it.
 */

import {
  getLocaleFromPathname,
  isLocale,
  stripLocaleFromPathname,
  type Locale,
} from "@/lib/i18n/config";

export const linkPreviewKinds = [
  "profile",
  "project",
  "article",
  "poll",
] as const;

export type LinkPreviewKind = (typeof linkPreviewKinds)[number];

export type LinkPreviewTarget = {
  kind: LinkPreviewKind;
  /** Username for profiles, slug (or legacy uuid) for content. */
  key: string;
  /**
   * Locale taken from the href itself. `null` for locale-less hrefs — the
   * caller then falls back to the viewer's current locale.
   */
  locale: Locale | null;
};

/**
 * The card payload. Every field is already localized and display-ready: the
 * route builds it server-side where the dictionaries live, so the client
 * renders one uniform card for every kind and ships no dictionary of its own.
 */
export type LinkPreview = {
  kind: LinkPreviewKind;
  /** Localized kind label shown as the card eyebrow. */
  eyebrow: string;
  title: string;
  /** `@username` for profiles, "By Author" for content. */
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageShape: "avatar" | "cover";
  /** Rating pill, e.g. "128 score". */
  badge: string | null;
  /** Small pills: location, skills, view counts, … (max 3). */
  chips: string[];
};

/** Longest route key we will look up — guards the DB query payload. */
const MAX_KEY_LENGTH = 200;

/**
 * Second segments that are sub-routes rather than content keys. Without this
 * `/projects/tag/react` would be read as the project slug "tag".
 */
const RESERVED_KEYS = new Set([
  "new",
  "edit",
  "tag",
  "type",
  "skill",
  "role",
  "feed.xml",
]);

function decodeSegment(value: string): string | null {
  try {
    // Hrefs in the DOM are percent-encoded (Cyrillic slugs, spaces), while
    // hrefs handed to us as React props usually are not. decode covers both.
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function toKind(prefix: string): LinkPreviewKind | null {
  switch (prefix) {
    case "u":
      return "profile";
    case "projects":
      return "project";
    // News posts are articles with an admin-only category; they share the
    // articles table and the same preview shape.
    case "articles":
    case "news":
      return "article";
    case "polls":
      return "poll";
    default:
      return null;
  }
}

/**
 * Parses an internal href into a preview target, or returns `null` when the
 * link is not previewable (external, a listing page, an editor route, …).
 *
 * Only same-origin, path-only hrefs qualify. Anything carrying a scheme or a
 * protocol-relative prefix points at another site and is rejected outright,
 * so a hostile href can never steer the API route off our own routes.
 */
export function parseLinkPreviewHref(
  rawHref: string | null | undefined,
): LinkPreviewTarget | null {
  if (!rawHref || !rawHref.startsWith("/") || rawHref.startsWith("//")) {
    return null;
  }

  const pathname = rawHref.split("#")[0]!.split("?")[0]!;
  const localeSegment = pathname.split("/")[1] ?? "";
  const locale = isLocale(localeSegment)
    ? getLocaleFromPathname(pathname)
    : null;

  const segments = stripLocaleFromPathname(pathname)
    .split("/")
    .filter(Boolean);

  if (segments.length !== 2) {
    return null;
  }

  const kind = toKind(segments[0]!);
  if (!kind) {
    return null;
  }

  const key = decodeSegment(segments[1]!);
  if (!key || key.length > MAX_KEY_LENGTH || RESERVED_KEYS.has(key)) {
    return null;
  }

  return { kind, key, locale };
}

/** Stable cache key for a resolved target — used by the client-side cache. */
export function linkPreviewCacheKey(
  target: LinkPreviewTarget,
  fallbackLocale: Locale,
): string {
  return `${target.kind}:${target.locale ?? fallbackLocale}:${target.key.toLowerCase()}`;
}
