import "server-only";

import {
  buildEmailOneClickUrl,
  emailUnsubscribeToken,
  isValidEmailUnsubscribeToken,
} from "@/lib/email-unsubscribe-token";

// The message emails' "stop these emails" link (email-unsubscribe-token.ts,
// kind "messages"). Kept for the links in emails already sent, which point at
// /api/messages/email-unsubscribe; new emails use /api/email-unsubscribe.

export function messageEmailUnsubscribeToken(userId: string): string | null {
  return emailUnsubscribeToken("messages", userId);
}

export function isValidMessageEmailUnsubscribeToken(userId: unknown, token: unknown): userId is string {
  return isValidEmailUnsubscribeToken("messages", userId, token);
}

/** Where a mail service POSTs the one-click unsubscribe (List-Unsubscribe). */
export function buildMessageEmailOneClickUrl(userId: string): string | null {
  return buildEmailOneClickUrl("messages", userId);
}
