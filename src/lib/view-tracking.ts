import { z } from "zod";

// ---------------------------------------------------------------------------
// Portfolio view tracking for the product metrics (plan part 3). Pure helpers
// shared by the browser beacon and /api/metrics/view.
//
// Separate from the public views_count counters on projects and articles:
// those count one view per signed-in user forever, while these events count
// every visitor once a day, guests included, together with where they came
// from. See database/2026-09-26-product-metrics.sql for the storage side.
// ---------------------------------------------------------------------------

// Vacancy and company pages since hiring 8.2 (database/2026-09-30-vacancies.sql).
export const VIEW_TARGET_TYPES = ["profile", "project", "article", "vacancy", "company"] as const;
export type ViewTargetType = (typeof VIEW_TARGET_TYPES)[number];

export const VIEW_SOURCES = ["internal", "external", "direct"] as const;
export type ViewSource = (typeof VIEW_SOURCES)[number];

export const viewBeaconSchema = z.object({
  targetType: z.enum(VIEW_TARGET_TYPES),
  targetId: z.string().uuid(),
  referrer: z.string().max(2048).nullish(),
});

export type ViewBeaconPayload = z.infer<typeof viewBeaconSchema>;

/**
 * Lower-cased host without a port, a leading `www.` or a trailing dot; null if
 * unusable. Accepts a `Host` header value as well as a URL's hostname.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  const value = host
    ?.trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!value || value.length > 253) {
    return null;
  }
  return value;
}

export function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return normalizeHost(new URL(value).hostname);
  } catch {
    return null;
  }
}

/**
 * Where a page view came from. Only the referring host is kept — never the full
 * URL, which can carry search queries or private links.
 */
export function classifyReferrer(
  referrer: string | null | undefined,
  siteHosts: ReadonlyArray<string | null | undefined>,
): { source: ViewSource; referrerHost: string | null } {
  const referrerHost = hostFromUrl(referrer);

  if (!referrerHost) {
    return { source: "direct", referrerHost: null };
  }

  const ownHosts = new Set(
    siteHosts.map((host) => normalizeHost(host)).filter(Boolean),
  );

  if (ownHosts.has(referrerHost)) {
    return { source: "internal", referrerHost: null };
  }

  return { source: "external", referrerHost };
}

/**
 * In a client-side navigation `document.referrer` still names whatever page
 * opened the tab, so a visitor who arrives from LinkedIn and then clicks
 * through to a project would count that project as a LinkedIn view too. Only the
 * page the browser actually loaded keeps the real referrer; any page reached
 * after it was reached from the site itself.
 */
export function resolveBeaconReferrer({
  navigationUrl,
  currentUrl,
  documentReferrer,
}: {
  /** URL of the document load (the Navigation Timing entry), if known. */
  navigationUrl: string | null | undefined;
  currentUrl: string;
  documentReferrer: string;
}): string {
  let current: URL;
  try {
    current = new URL(currentUrl);
  } catch {
    return documentReferrer;
  }

  if (!navigationUrl) {
    return documentReferrer;
  }

  try {
    const landing = new URL(navigationUrl);
    if (landing.pathname === current.pathname) {
      return documentReferrer;
    }
  } catch {
    // An unreadable entry says nothing about this page; fall through.
  }

  return `${current.origin}/`;
}

// Crawlers, link unfurlers, uptime checks and scripted clients. Link-preview
// bots rarely run the beacon at all; this catches the ones that render JS.
// Messenger names are deliberately absent: their in-app browsers can carry the
// app's name in the user agent, and those are exactly the visitors we want. The
// messengers' own preview fetchers (TelegramBot, Discordbot) end in "bot".
const BOT_USER_AGENT =
  /bot\b|bot[/;-]|crawl|spider|slurp|headless|lighthouse|inspectiontool|facebookexternalhit|embedly|curl\/|wget\/|python|axios\/|node-fetch|undici|go-http-client|java\/|okhttp|postman|insomnia/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 10) {
    return true;
  }
  return BOT_USER_AGENT.test(userAgent);
}

/**
 * The raw input the database hashes with the day's salt. A signed-in viewer is
 * recognised by account so switching networks does not double-count them; a
 * guest by IP and user agent. Neither value is stored.
 */
export function buildVisitorSeed({
  userId,
  ip,
  userAgent,
}: {
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
}): string {
  if (userId) {
    return `u:${userId}`;
  }
  return `a:${ip || "unknown"}|${userAgent || ""}`;
}

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}
