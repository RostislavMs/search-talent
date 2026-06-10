import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type { NotificationItem } from "@/lib/constants/notifications";

type NotificationDict = Dictionary["notifications"];

/**
 * Resolves a localized phrase like "left a 🔥 reaction on your comment".
 * The subject (actor name) is rendered by the caller; this returns only
 * the action portion.
 */
export function describeNotification(
  item: NotificationItem,
  dict: NotificationDict,
): string {
  switch (item.type) {
    case "mention":
      return dict.actions.mention;
    case "comment_reply":
      return dict.actions.commentReply;
    case "new_comment":
      return dict.actions.newComment;
    case "reaction":
      return dict.actions.reaction.replace(
        "{emoji}",
        item.metadata.emoji || "",
      );
    case "new_follower":
      return dict.actions.newFollower;
    case "new_badge": {
      const isUkrainian = dict.actions.mention.includes("згад");
      const localizedName = isUkrainian
        ? item.metadata.badgeNameUk
        : item.metadata.badgeNameEn;
      const badge = `${item.metadata.badgeEmoji ?? "🏅"} ${localizedName ?? ""}`.trim();
      return dict.actions.newBadge.replace("{badge}", badge);
    }
    case "moderation_decision": {
      const status = item.metadata.moderationStatus;
      const kind = item.metadata.contentKind;
      if (status && kind) {
        return dict.actions.moderation[status][kind];
      }
      return "";
    }
    default:
      return "";
  }
}

/**
 * Builds the deep-link a notification should open. Falls back to the
 * notifications index when the target cannot be resolved (e.g. it was
 * deleted after the notification was emitted).
 */
export function buildNotificationHref(
  item: NotificationItem,
  locale: Locale,
): string {
  const base = `/${locale}`;

  switch (item.targetType) {
    case "article":
      if (item.metadata.articleSlug) {
        return `${base}/articles/${item.metadata.articleSlug}`;
      }
      return `${base}/articles`;
    case "article_comment":
      if (item.metadata.articleSlug) {
        return `${base}/articles/${item.metadata.articleSlug}#comment-${item.targetId ?? ""}`;
      }
      return `${base}/articles`;
    case "project":
      if (item.metadata.projectId) {
        return `${base}/projects/${item.metadata.projectId}`;
      }
      return `${base}/projects`;
    case "project_comment":
      if (item.metadata.projectId) {
        return `${base}/projects/${item.metadata.projectId}#comment-${item.targetId ?? ""}`;
      }
      return `${base}/projects`;
    case "profile":
      if (item.metadata.actorUsername) {
        return `${base}/u/${item.metadata.actorUsername}`;
      }
      if (item.metadata.profileUsername) {
        return `${base}/u/${item.metadata.profileUsername}`;
      }
      return `${base}/talents`;
    case "badge":
      if (item.metadata.profileUsername) {
        return `${base}/u/${item.metadata.profileUsername}`;
      }
      return `${base}/notifications`;
    default:
      return `${base}/notifications`;
  }
}
