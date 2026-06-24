import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/config";
import type {
  NotificationItem,
  NotificationType,
} from "@/lib/constants/notifications";

type NotificationDict = Dictionary["notifications"];

/**
 * Top-level buckets the /notifications page exposes as filter chips. Many
 * raw notification types collapse into one user-facing category (e.g. all
 * comment/reply/mention events read as "mentions & comments").
 */
export type NotificationCategory =
  | "mentions"
  | "reactions"
  | "follows"
  | "content"
  | "coAuthors"
  | "moderation"
  | "badges";

const CATEGORY_BY_TYPE: Record<NotificationType, NotificationCategory> = {
  mention: "mentions",
  new_comment: "mentions",
  comment_reply: "mentions",
  reaction: "reactions",
  new_follower: "follows",
  new_content: "content",
  co_author_invite: "coAuthors",
  co_author_accepted: "coAuthors",
  co_author_declined: "coAuthors",
  co_author_published: "coAuthors",
  moderation_decision: "moderation",
  new_badge: "badges",
};

export function getNotificationCategory(
  item: NotificationItem,
): NotificationCategory {
  return CATEGORY_BY_TYPE[item.type];
}

/**
 * Resolves the bold "subject" shown before the action text. Badges are the
 * recipient's own achievement ("You earned…"), moderation is the platform
 * acting ("Moderation removed…"), everything else is the acting user. Shared
 * by the bell dropdown and the full list so the two never drift apart.
 */
export function resolveActorName(
  item: NotificationItem,
  dict: NotificationDict,
): string {
  if (item.type === "new_badge") return dict.you;
  if (item.type === "moderation_decision") return dict.moderationActor;
  return (
    item.metadata.actorName || item.metadata.actorUsername || dict.someone
  );
}

/**
 * Emoji used in place of an avatar when a notification has no human actor
 * (badge award, moderation action). Returns null when an avatar/initial
 * should be shown instead.
 */
export function resolveNotificationEmoji(
  item: NotificationItem,
): string | null {
  if (item.type === "new_badge") return item.metadata.badgeEmoji ?? "🏅";
  if (item.type === "moderation_decision") return "🛡️";
  return null;
}

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
    case "new_content": {
      const title = item.metadata.contentTitle ?? "";
      const template =
        item.targetType === "project"
          ? dict.actions.newProject
          : item.targetType === "poll"
            ? dict.actions.newPoll
            : dict.actions.newArticle;
      return template.replace("{title}", title);
    }
    case "co_author_invite":
      return dict.actions.coAuthorInvite.replace(
        "{title}",
        item.metadata.coAuthorContentTitle ?? "",
      );
    case "co_author_accepted":
      return dict.actions.coAuthorAccepted.replace(
        "{title}",
        item.metadata.coAuthorContentTitle ?? "",
      );
    case "co_author_declined":
      return dict.actions.coAuthorDeclined.replace(
        "{title}",
        item.metadata.coAuthorContentTitle ?? "",
      );
    case "co_author_published":
      return dict.actions.coAuthorPublished.replace(
        "{title}",
        item.metadata.coAuthorContentTitle ?? "",
      );
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

  // Moderation removals delete the underlying content, so deep-linking to it
  // would 404. Send the owner to their dashboard where the decision (and any
  // appeal path) is visible. Restrictions keep the content, so they fall
  // through to the normal target resolution below.
  if (
    item.type === "moderation_decision" &&
    item.metadata.moderationStatus === "removed"
  ) {
    return `${base}/dashboard`;
  }

  // Co-author notifications carry the content type + slug in metadata.
  if (item.metadata.coAuthorContentType && item.metadata.coAuthorContentSlug) {
    const slug = item.metadata.coAuthorContentSlug;
    switch (item.metadata.coAuthorContentType) {
      case "project":
        return `${base}/projects/${slug}`;
      case "article":
        return `${base}/articles/${slug}`;
      case "poll":
        return `${base}/polls/${slug}`;
    }
  }

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
    case "poll":
      if (item.metadata.pollSlug) {
        return `${base}/polls/${item.metadata.pollSlug}`;
      }
      return `${base}/polls`;
    case "poll_comment":
      if (item.metadata.pollSlug) {
        return `${base}/polls/${item.metadata.pollSlug}#comment-${item.targetId ?? ""}`;
      }
      return `${base}/polls`;
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
      return `${base}/dashboard`;
    default:
      return `${base}/notifications`;
  }
}
