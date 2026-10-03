import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { JOB_ALERTS_UNSUBSCRIBE_PATH } from "@/lib/job-alerts";
import type { Locale } from "@/lib/i18n/config";
import { getSiteUrl } from "@/lib/seo";

// The link at the bottom of a job alert email turns the emails off without
// signing in, as mail services expect (RFC 8058 one-click unsubscribe). It
// carries the person's id and an HMAC of it, keyed with the service key — the
// same key the cron needs to send anything at all, so without it there is
// nothing to unsubscribe from and no token is made.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function jobAlertUnsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key || !UUID_PATTERN.test(userId)) {
    return null;
  }
  return createHmac("sha256", key).update(`job-alerts:unsubscribe:${userId.toLowerCase()}`).digest("hex");
}

export function isValidJobAlertUnsubscribeToken(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== "string" || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return false;
  }

  const expected = jobAlertUnsubscribeToken(userId);
  if (!expected) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}

function siteBase(): string {
  return getSiteUrl().replace(/\/$/, "");
}

/** The page a person opens from the email: one button turns the emails off. */
export function buildJobAlertUnsubscribePageUrl(locale: Locale, userId: string): string | null {
  const token = jobAlertUnsubscribeToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({ u: userId, t: token });
  return `${siteBase()}/${locale}${JOB_ALERTS_UNSUBSCRIBE_PATH}?${params.toString()}`;
}

/** Where a mail service POSTs the one-click unsubscribe (List-Unsubscribe). */
export function buildJobAlertOneClickUrl(userId: string): string | null {
  const token = jobAlertUnsubscribeToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({ u: userId, t: token });
  return `${siteBase()}/api/job-alerts/unsubscribe?${params.toString()}`;
}
