import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getSiteUrl } from "@/lib/seo";

// "Stop these emails" works without signing in, as mail services expect (RFC
// 8058 one-click unsubscribe). Like the job alert link (job-alert-token.ts)
// the link carries the person's id and an HMAC of it keyed with the service
// key, under a prefix per kind of email: a link from a message email cannot
// turn off the follower emails, and the other way round.

export const emailUnsubscribeKinds = ["messages", "followers"] as const;
export type EmailUnsubscribeKind = (typeof emailUnsubscribeKinds)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function emailUnsubscribeToken(kind: EmailUnsubscribeKind, userId: string): string | null {
  const key = secret();
  if (!key || !UUID_PATTERN.test(userId)) {
    return null;
  }
  return createHmac("sha256", key).update(`${kind}:unsubscribe:${userId.toLowerCase()}`).digest("hex");
}

export function isValidEmailUnsubscribeToken(
  kind: EmailUnsubscribeKind,
  userId: unknown,
  token: unknown,
): userId is string {
  if (typeof userId !== "string" || typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return false;
  }

  const expected = emailUnsubscribeToken(kind, userId);
  if (!expected) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
}

/** Where a mail service POSTs the one-click unsubscribe (List-Unsubscribe). */
export function buildEmailOneClickUrl(kind: EmailUnsubscribeKind, userId: string): string | null {
  const token = emailUnsubscribeToken(kind, userId);
  if (!token) return null;
  const params = new URLSearchParams({ k: kind, u: userId, t: token });
  return `${getSiteUrl().replace(/\/$/, "")}/api/email-unsubscribe?${params.toString()}`;
}

/** The List-Unsubscribe headers for an email of this kind to this person, or none without the key. */
export function oneClickUnsubscribeHeaders(
  kind: EmailUnsubscribeKind,
  userId: string,
): Record<string, string> | undefined {
  const url = buildEmailOneClickUrl(kind, userId);
  return url ? { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
}
