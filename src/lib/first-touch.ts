import { z } from "zod";
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

const UTM_MAX = 100;
const PATH_MAX = 300;
/** Longer than any consent lifetime; anything older is a corrupt value. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

const firstTouchSchema = z.object({
  v: z.literal(1),
  referrerHost: z.string().max(253).nullable(),
  utmSource: z.string().max(UTM_MAX).nullable(),
  utmMedium: z.string().max(UTM_MAX).nullable(),
  utmCampaign: z.string().max(UTM_MAX).nullable(),
  landingPath: z.string().max(PATH_MAX).nullable(),
  /** Epoch ms on the browser's clock. */
  firstSeenAt: z.number().int().nonnegative(),
  sent: z.boolean(),
});

export type FirstTouch = z.infer<typeof firstTouchSchema>;

export const signupSourceSchema = z.object({
  referrerHost: z.string().max(253).nullable(),
  utmSource: z.string().max(UTM_MAX).nullable(),
  utmMedium: z.string().max(UTM_MAX).nullable(),
  utmCampaign: z.string().max(UTM_MAX).nullable(),
  landingPath: z.string().max(PATH_MAX).nullable(),
  firstSeenAgeSeconds: z.number().int().min(0).max(MAX_AGE_SECONDS),
});

export type SignupSourcePayload = z.infer<typeof signupSourceSchema>;

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

export function parseFirstTouch(raw: string | null | undefined): FirstTouch | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = firstTouchSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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
