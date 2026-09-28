import { locales } from "@/lib/i18n/config";

// ---------------------------------------------------------------------------
// Links the share loop hands out (plan part 6), and how the product metrics
// (plan part 3) recognise a sign-up that came through someone's portfolio.
//
// Only links nobody reads get a tag: the README badge, QR codes and the link in
// the PDF résumé. A link people copy into a CV or a post stays clean — a visitor
// who opens it lands on a portfolio page, and the landing path already says so.
// The tags are ordinary UTM parameters, so lib/first-touch records them with no
// changes (and only with analytics consent, like every other source).
// ---------------------------------------------------------------------------

/** `utm_medium` of every link the share loop tags. */
export const SHARE_TAG_MEDIUM = "portfolio";

/** `utm_source` values: where the tagged link was printed. */
export const SHARE_TAGS = ["badge", "qr", "resume"] as const;

export type ShareTag = (typeof SHARE_TAGS)[number];

export function isShareTag(value: string | null | undefined): value is ShareTag {
  return (SHARE_TAGS as readonly string[]).includes(value ?? "");
}

export function withShareTag(url: string, tag: ShareTag): string {
  const target = new URL(url);
  target.searchParams.set("utm_source", tag);
  target.searchParams.set("utm_medium", SHARE_TAG_MEDIUM);
  return target.toString();
}

/** The address as people read it: no scheme, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// `/projects/new`, `/projects/edit/…` and the facet listings are not someone's
// work.
const NOT_A_PROJECT = new Set(["new", "edit", "tag", "type"]);

/**
 * A public portfolio page: a profile (with its tabs) or a project, with or
 * without the locale prefix.
 */
export function isPortfolioPath(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  const segments = path.split("?")[0].split("/").filter(Boolean);

  if ((locales as readonly string[]).includes(segments[0] ?? "")) {
    segments.shift();
  }

  const [section, slug] = segments;

  if (!slug) {
    return false;
  }

  return section === "u" || (section === "projects" && !NOT_A_PROJECT.has(slug));
}
