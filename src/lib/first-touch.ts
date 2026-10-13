import { hostFromUrl } from "@/lib/view-tracking";

// ---------------------------------------------------------------------------
// Sign-up source for the product metrics (plan part 3): where the visit that
// ended in a new account came from.
//
// Kept only with analytics consent. The browser stores the first touch in
// localStorage from the first page it sees, and after sign-up the tracker
// (components/first-touch-tracker) reports it once to
// /api/metrics/signup-source. Only the referring host, UTM tags and the landing
// path are kept — no full URLs, no query strings.
// ---------------------------------------------------------------------------

export const FIRST_TOUCH_STORAGE_KEY = "st_first_touch";

export const HOST_MAX = 253;
export const UTM_MAX = 100;
export const PATH_MAX = 300;
/** Longer than any consent lifetime; anything older is a corrupt value. */
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export type FirstTouch = {
  v: 1;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  /** Epoch ms on the browser's clock. */
  firstSeenAt: number;
  sent: boolean;
};

/** Checked on the server by `signupSourceSchema` (lib/validation/metrics). */
export type SignupSourcePayload = {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  landingPath: string | null;
  firstSeenAgeSeconds: number;
};

function isShortTextOrNull(value: unknown, max: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= max);
}

function cleanTag(value: string | null, lowerCase: boolean): string | null {
  const trimmed = value?.trim().slice(0, UTM_MAX) || null;
  return trimmed && lowerCase ? trimmed.toLowerCase() : trimmed;
}

/**
 * The first touch of a visit, from the URL the browser loaded and the page that
 * sent the visitor there. A referrer on the site itself is not a source.
 */
export function buildFirstTouch({
  landingUrl,
  documentReferrer,
  now,
}: {
  landingUrl: string;
  documentReferrer: string;
  now: number;
}): FirstTouch | null {
  let landing: URL;
  try {
    landing = new URL(landingUrl);
  } catch {
    return null;
  }

  const referrerHost = hostFromUrl(documentReferrer);
  const params = landing.searchParams;

  return {
    v: 1,
    referrerHost:
      referrerHost && referrerHost !== hostFromUrl(landing.href) ? referrerHost : null,
    utmSource: cleanTag(params.get("utm_source"), true),
    utmMedium: cleanTag(params.get("utm_medium"), true),
    utmCampaign: cleanTag(params.get("utm_campaign"), false),
    landingPath: landing.pathname.slice(0, PATH_MAX) || null,
    firstSeenAt: Math.max(0, Math.floor(now)),
    sent: false,
  };
}

/**
 * Checked by hand rather than with zod: the tracker runs in the browser on every
 * page, and zod alone would add about 60KB of JavaScript to each of them.
 */
export function parseFirstTouch(raw: string | null | undefined): FirstTouch | null {
  if (!raw) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const {
    v,
    referrerHost,
    utmSource,
    utmMedium,
    utmCampaign,
    landingPath,
    firstSeenAt,
    sent,
  } = value as Record<string, unknown>;

  if (
    v !== 1 ||
    !isShortTextOrNull(referrerHost, HOST_MAX) ||
    !isShortTextOrNull(utmSource, UTM_MAX) ||
    !isShortTextOrNull(utmMedium, UTM_MAX) ||
    !isShortTextOrNull(utmCampaign, UTM_MAX) ||
    !isShortTextOrNull(landingPath, PATH_MAX) ||
    typeof firstSeenAt !== "number" ||
    !Number.isSafeInteger(firstSeenAt) ||
    firstSeenAt < 0 ||
    typeof sent !== "boolean"
  ) {
    return null;
  }

  return {
    v,
    referrerHost,
    utmSource,
    utmMedium,
    utmCampaign,
    landingPath,
    firstSeenAt,
    sent,
  };
}

export function serializeFirstTouch(touch: FirstTouch): string {
  return JSON.stringify(touch);
}

/**
 * The age travels instead of the timestamp: it is measured on the browser's own
 * clock, so a device set to the wrong date cannot move the first touch to the
 * other side of the sign-up.
 */
export function toSignupSourcePayload(
  touch: FirstTouch,
  now: number,
): SignupSourcePayload {
  return {
    referrerHost: touch.referrerHost,
    utmSource: touch.utmSource,
    utmMedium: touch.utmMedium,
    utmCampaign: touch.utmCampaign,
    landingPath: touch.landingPath,
    firstSeenAgeSeconds: Math.min(
      MAX_AGE_SECONDS,
      Math.max(0, Math.floor((now - touch.firstSeenAt) / 1000)),
    ),
  };
}
