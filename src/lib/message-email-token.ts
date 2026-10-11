import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSiteUrl } from "@/lib/seo";

// "Stop these emails" in a message email works without signing in, as mail
// services expect (RFC 8058 one-click unsubscribe). Like the job alert link
// (job-alert-token.ts) it carries the person's id and an HMAC of it keyed with
// the service key, but under its own prefix: one link cannot turn off the
// other kind of email.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function messageEmailUnsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key || !UUID_PATTERN.test(userId)) {
    return null;
  }
  return createHmac("sha256", key).update(`messages:unsubscribe:${userId.toLowerCase()}`).digest("hex");
}

export function isValidMessageEmailUnsubscribeToken(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== "string" || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return false;
  }

  const expected = messageEmailUnsubscribeToken(userId);
  if (!expected) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}

/** Where a mail service POSTs the one-click unsubscribe (List-Unsubscribe). */
export function buildMessageEmailOneClickUrl(userId: string): string | null {
  const token = messageEmailUnsubscribeToken(userId);
  if (!token) return null;
  const params = new URLSearchParams({ u: userId, t: token });
  return `${getSiteUrl().replace(/\/$/, "")}/api/messages/email-unsubscribe?${params.toString()}`;
}
