import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/db/notifications";
import type { NotificationTargetType } from "@/lib/constants/notifications";

type PublishContentType = Extract<NotificationTargetType, "article" | "project" | "poll">;

type PublishEventInput = {
  contentType: PublishContentType;
  /** Row id in `articles` / `projects` / `polls`. */
  contentId: string;
  /** Content owner — the actor shown on the notification and whose followers are pinged. */
  authorUserId: string;
  /** Title shown in the notification copy. */
  title: string;
  /** Article slug for the deep-link. Ignored for projects (linked by id). */
  articleSlug?: string | null;
  /** Poll slug for the deep-link. */
  pollSlug?: string | null;
};

/**
 * Notifies a creator's followers that they published a new project or article.
 *
 * Idempotency: the content's `followers_notified_at` flag is claimed atomically
 * (`UPDATE ... WHERE followers_notified_at IS NULL`). Only the call that wins the
 * claim fans out notifications, so followers are pinged exactly once — on the
 * first publish — and never again on later edits or a draft/published toggle.
 *
 * Fire-and-forget from the caller's perspective: any failure is logged but never
 * thrown, so it can never block the publish that produced it. Callers are
 * responsible for gating on "published and publicly visible" before invoking.
 */
export async function dispatchPublishSideEffects(
  input: PublishEventInput,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    const table =
      input.contentType === "article"
        ? "articles"
        : input.contentType === "poll"
          ? "polls"
          : "projects";

    // Atomically claim the notify flag. A returned row means we are the first
    // to publish this content; an empty result means it was already notified
    // (or a concurrent publish won the race) — bail so we never double-notify.
    const { data: claimed } = await admin
      .from(table)
      .update({ followers_notified_at: new Date().toISOString() })
      .eq("id", input.contentId)
      .is("followers_notified_at", null)
      .select("id")
      .maybeSingle();

    if (!claimed) return;

    const { data: followers } = await admin
      .from("follows")
      .select("follower_user_id")
      .eq("following_user_id", input.authorUserId);

    const recipientIds = Array.from(
      new Set(
        (followers ?? [])
          .map((row) => row.follower_user_id as string)
          .filter((id): id is string => Boolean(id) && id !== input.authorUserId),
      ),
    );

    if (recipientIds.length === 0) return;

    const metadata =
      input.contentType === "article"
        ? { contentTitle: input.title, articleSlug: input.articleSlug ?? undefined }
        : input.contentType === "poll"
          ? { contentTitle: input.title, pollSlug: input.pollSlug ?? undefined }
          : { contentTitle: input.title, projectId: input.contentId };

    await createNotifications(
      admin,
      recipientIds.map((recipientUserId) => ({
        recipientUserId,
        actorUserId: input.authorUserId,
        type: "new_content" as const,
        targetType: input.contentType,
        targetId: input.contentId,
        metadata,
      })),
    );
  } catch (error) {
    console.error("[publish-events] dispatch failed", error);
  }
}
