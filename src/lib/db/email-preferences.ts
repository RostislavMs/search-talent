import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailUnsubscribeKind } from "@/lib/email-unsubscribe-token";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  type MessageEmailMode,
  type NotificationPreferences,
} from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The email choices (notification_preferences, the messages-polish
 * migration): message emails at once, once a day or never, and follower
 * emails on or off. The database keeps them and decides with them — who gets
 * a message email, the morning digest, whether a follower email may go — so
 * this module only reads and saves them.
 */

function idsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id !== "") : [];
}

/** The caller's choices; the defaults on any error, e.g. before the migration. */
export async function getNotificationPreferences(supabase: SupabaseClient): Promise<NotificationPreferences> {
  const { data, error } = await supabase.rpc("my_notification_preferences");
  return error ? DEFAULT_NOTIFICATION_PREFERENCES : normalizeNotificationPreferences(data);
}

/**
 * Saves any of the two. Leaving "at once" for message emails returns the
 * Resend ids of the emails still waiting, for cancelMessageEmails().
 */
export async function saveNotificationPreferences(
  supabase: SupabaseClient,
  input: { messageEmails?: MessageEmailMode; followerEmails?: boolean },
): Promise<{ preferences: NotificationPreferences; cancelEmailIds: string[] } | null> {
  const { data, error } = await supabase.rpc("save_notification_preferences", {
    p_message_emails: input.messageEmails ?? null,
    p_follower_emails: input.followerEmails ?? null,
  });

  const row = (data ?? null) as { status?: unknown; preferences?: unknown; cancel_email_ids?: unknown } | null;

  if (error || !row || row.status !== "ok") {
    if (error) {
      console.error("[email-preferences] save failed:", error.message);
    }
    return null;
  }

  return {
    preferences: normalizeNotificationPreferences(row.preferences),
    cancelEmailIds: idsOf(row.cancel_email_ids),
  };
}

/** The one-click "stop these emails" link. False without the service key or on an error. */
export async function turnOffEmails(kind: EmailUnsubscribeKind, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin.rpc(kind === "messages" ? "turn_off_message_emails" : "turn_off_follower_emails", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[email-preferences] turning emails off failed:", { kind, error: error.message });
    return false;
  }
  return true;
}

/**
 * May a "new follower" email go out now? The database says yes when the
 * person keeps these emails on, the follow is real and not across a block,
 * this follower was not emailed about in the last 30 days, and fewer than 3
 * went to them today — and records the yes, so ask right before sending.
 */
export async function claimFollowerEmail(
  admin: SupabaseClient,
  followerUserId: string,
  followingUserId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_follower_email", {
    p_follower_user_id: followerUserId,
    p_following_user_id: followingUserId,
  });

  if (error) {
    console.error("[email-preferences] follower email check failed:", error.message);
    return false;
  }

  return data === true;
}
