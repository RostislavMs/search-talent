import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MENTION_MAX_PER_SOURCE,
  extractMentionUsernames,
} from "@/lib/constants/mentions";

export type MentionSourceType =
  | "project_comment"
  | "article_comment"
  | "article";

export type ResolvedMention = {
  userId: string;
  username: string;
};

/**
 * Looks up profile user ids by username (case-insensitive). Missing
 * usernames are silently dropped — mentioning a non-existing user is a
 * no-op rather than an error.
 *
 * Requires service-role or any client that can `SELECT user_id, username`
 * from `profiles` for the supplied usernames.
 */
export async function resolveMentionUsernames(
  supabase: SupabaseClient,
  usernames: string[],
): Promise<ResolvedMention[]> {
  if (usernames.length === 0) return [];

  // Limit the query payload regardless of caller input.
  const limited = usernames.slice(0, MENTION_MAX_PER_SOURCE);

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("username", limited);

  if (error || !data) return [];

  return data
    .filter(
      (row): row is { user_id: string; username: string } =>
        Boolean(row.user_id && row.username),
    )
    .map((row) => ({ userId: row.user_id, username: row.username }));
}

/**
 * Persists mention rows for a single source, returning the resolved
 * recipients so the caller can fan out notifications.
 *
 * - De-duplicates by mentioned_user_id.
 * - Skips self-mentions (author cannot ping themselves).
 * - On insert failure returns an empty list rather than throwing — a
 *   broken mention table must never block the parent write (e.g.
 *   posting a comment).
 */
export async function persistMentionsFromText(
  supabase: SupabaseClient,
  params: {
    text: string;
    sourceType: MentionSourceType;
    sourceId: string;
    authorUserId: string;
  },
): Promise<ResolvedMention[]> {
  const { text, sourceType, sourceId, authorUserId } = params;

  const usernames = extractMentionUsernames(text);
  if (usernames.length === 0) return [];

  const resolved = await resolveMentionUsernames(supabase, usernames);

  const recipients = resolved.filter(
    (entry) => entry.userId !== authorUserId,
  );

  if (recipients.length === 0) return [];

  const rows = recipients.map((entry) => ({
    mentioned_user_id: entry.userId,
    author_user_id: authorUserId,
    source_type: sourceType,
    source_id: sourceId,
  }));

  const { error } = await supabase.from("mentions").insert(rows);

  if (error) {
    // Logged but non-fatal: parent write already committed.
    console.error("[mentions] insert failed", error);
    return [];
  }

  return recipients;
}
