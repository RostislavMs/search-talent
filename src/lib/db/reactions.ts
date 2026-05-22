import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REACTION_EMOJIS,
  type ReactionEmoji,
  type ReactionSummary,
  type ReactionTargetType,
  type ReactionsByTarget,
} from "@/lib/constants/reactions";

type ReactionRow = {
  target_type: ReactionTargetType;
  target_id: string;
  emoji: ReactionEmoji;
  user_id: string;
};

/**
 * Toggles a single (user, target, emoji) reaction. Returns `true` if the
 * row exists after the operation (i.e. just added), `false` if it was
 * removed. Errors bubble up to the caller.
 */
export async function toggleReaction(
  supabase: SupabaseClient,
  params: {
    userId: string;
    targetType: ReactionTargetType;
    targetId: string;
    emoji: ReactionEmoji;
  },
): Promise<{ active: boolean }> {
  const { userId, targetType, targetId, emoji } = params;

  const { data: existing, error: selectError } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return { active: false };
  }

  const { error } = await supabase.from("reactions").insert({
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
    emoji,
  });
  if (error) throw error;

  return { active: true };
}

/**
 * Loads aggregated reaction summaries for a set of targets. Returns a
 * map keyed by target_id whose values are arrays in canonical emoji
 * order. `reactedByMe` is true only for the supplied viewer.
 */
export async function getReactionsForTargets(
  supabase: SupabaseClient,
  params: {
    targetType: ReactionTargetType;
    targetIds: string[];
    viewerUserId: string | null;
  },
): Promise<ReactionsByTarget> {
  const { targetType, targetIds, viewerUserId } = params;

  if (targetIds.length === 0) return {};

  const { data, error } = await supabase
    .from("reactions")
    .select("target_id, emoji, user_id")
    .eq("target_type", targetType)
    .in("target_id", targetIds);

  if (error) throw error;

  type Bucket = {
    counts: Map<ReactionEmoji, number>;
    mine: Set<ReactionEmoji>;
  };

  const buckets = new Map<string, Bucket>();

  for (const row of (data || []) as ReactionRow[]) {
    let bucket = buckets.get(row.target_id);
    if (!bucket) {
      bucket = { counts: new Map(), mine: new Set() };
      buckets.set(row.target_id, bucket);
    }
    bucket.counts.set(row.emoji, (bucket.counts.get(row.emoji) ?? 0) + 1);
    if (viewerUserId && row.user_id === viewerUserId) {
      bucket.mine.add(row.emoji);
    }
  }

  const result: ReactionsByTarget = {};

  for (const [targetId, bucket] of buckets) {
    const summary: ReactionSummary[] = [];
    for (const emoji of REACTION_EMOJIS) {
      const count = bucket.counts.get(emoji);
      if (!count) continue;
      summary.push({
        emoji,
        count,
        reactedByMe: bucket.mine.has(emoji),
      });
    }
    result[targetId] = summary;
  }

  return result;
}

/**
 * Resolves the recipient who should be notified when someone reacts to
 * the given target. Returns null for self-reactions or missing rows.
 */
export async function findReactionTargetAuthor(
  supabase: SupabaseClient,
  params: {
    targetType: ReactionTargetType;
    targetId: string;
  },
): Promise<string | null> {
  const { targetType, targetId } = params;

  if (targetType === "project_comment") {
    const { data } = await supabase
      .from("project_comments")
      .select("author_user_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.author_user_id ?? null;
  }

  if (targetType === "article_comment") {
    const { data } = await supabase
      .from("article_comments")
      .select("author_user_id")
      .eq("id", targetId)
      .maybeSingle();
    return data?.author_user_id ?? null;
  }

  const { data } = await supabase
    .from("articles")
    .select("author_user_id")
    .eq("id", targetId)
    .maybeSingle();
  return data?.author_user_id ?? null;
}
