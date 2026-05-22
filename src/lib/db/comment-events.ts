import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  persistMentionsFromText,
  type MentionSourceType,
} from "@/lib/db/mentions";
import { createNotifications } from "@/lib/db/notifications";
import type {
  NotificationTargetType,
  NotificationType,
} from "@/lib/constants/notifications";

type CommentEventInput = {
  sourceType: MentionSourceType;
  commentId: string;
  body: string;
  authorUserId: string;
  /** Author of the parent comment, if this is a reply (for comment_reply notifications). */
  parentAuthorUserId?: string | null;
  /** Author of the underlying article/project (for new_comment notifications). */
  contentOwnerUserId?: string | null;
  metadata?: {
    excerpt?: string;
    articleSlug?: string;
    projectId?: string;
  };
};

/**
 * Runs all side-effects that follow a successful comment insert:
 *   1. Extract @username mentions from the body and persist them.
 *   2. Notify the mentioned users (deduped against author and against
 *      the comment-reply / new-comment recipients below).
 *   3. Notify the parent comment author if this is a reply.
 *   4. Notify the article/project owner about the new top-level comment.
 *
 * The function is fire-and-forget from the caller's perspective: any
 * failure is logged but never thrown.
 */
export async function dispatchCommentSideEffects(
  input: CommentEventInput,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    const mentions = await persistMentionsFromText(admin, {
      text: input.body,
      sourceType: input.sourceType,
      sourceId: input.commentId,
      authorUserId: input.authorUserId,
    });

    const mentionedIds = new Set(mentions.map((m) => m.userId));

    const notificationTargetType: NotificationTargetType = input.sourceType;
    const baseMetadata = {
      excerpt: input.metadata?.excerpt,
      articleSlug: input.metadata?.articleSlug,
      projectId: input.metadata?.projectId,
    };

    const inserts: Array<{
      recipientUserId: string;
      type: NotificationType;
    }> = [];

    // 1) Mention notifications (skip if mentioning self)
    for (const userId of mentionedIds) {
      if (userId === input.authorUserId) continue;
      inserts.push({ recipientUserId: userId, type: "mention" });
    }

    // 2) Comment-reply notifications (skip if parent author == comment
    //    author or was already pinged via mention)
    if (
      input.parentAuthorUserId &&
      input.parentAuthorUserId !== input.authorUserId &&
      !mentionedIds.has(input.parentAuthorUserId)
    ) {
      inserts.push({
        recipientUserId: input.parentAuthorUserId,
        type: "comment_reply",
      });
    }

    // 3) New-comment to content owner (skip if owner == author, owner
    //    == parent recipient, or already mentioned)
    if (
      input.contentOwnerUserId &&
      input.contentOwnerUserId !== input.authorUserId &&
      input.contentOwnerUserId !== input.parentAuthorUserId &&
      !mentionedIds.has(input.contentOwnerUserId) &&
      !input.parentAuthorUserId // only fire for top-level comments
    ) {
      inserts.push({
        recipientUserId: input.contentOwnerUserId,
        type: "new_comment",
      });
    }

    if (inserts.length === 0) return;

    await createNotifications(
      admin,
      inserts.map((entry) => ({
        recipientUserId: entry.recipientUserId,
        actorUserId: input.authorUserId,
        type: entry.type,
        targetType: notificationTargetType,
        targetId: input.commentId,
        metadata: baseMetadata,
      })),
    );
  } catch (error) {
    console.error("[comment-events] dispatch failed", error);
  }
}
