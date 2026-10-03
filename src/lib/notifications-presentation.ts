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
  | "companies"
  | "applications"
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
  company_invite: "companies",
  company_invite_accepted: "companies",
  company_invite_declined: "companies",
  company_verified: "companies",
  company_member_left: "companies",
  company_member_removed: "companies",
  company_project_request: "companies",
  company_project_confirmed: "companies",
  company_project_declined: "companies",
  vacancy_approved: "companies",
  vacancy_expired: "companies",
  application_received: "applications",
  application_status: "applications",
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
  if (item.type === "moderation_decision" || item.type === "vacancy_approved") {
    return dict.moderationActor;
  }
  // The page itself is the subject: "Acme now has the verified mark".
  if (item.type === "company_verified") {
    return item.metadata.companyName || dict.someone;
  }
  // So is the vacancy: "Junior designer closed after 60 days".
  if (item.type === "vacancy_expired") {
    return item.metadata.vacancyTitle || dict.someone;
  }
  // The company answers an application: "Acme would like to talk about…".
  if (item.type === "application_status") {
    return item.metadata.companyName || dict.someone;
  }
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
  if (item.type === "company_verified" || item.type === "vacancy_approved") return "✅";
  if (item.type === "vacancy_expired") return "⏳";
  if (item.type === "application_status") {
    return item.metadata.applicationStatus === "hired" ? "🎉" : "💼";
  }
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
        return dict.actions.moderation[status][kind].replace(
          "{title}",
          item.metadata.contentTitle ?? "",
        );
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
    case "company_invite":
      return dict.actions.companyInvite.replace(
        "{company}",
        item.metadata.companyName ?? "",
      );
    case "company_invite_accepted":
      return dict.actions.companyInviteAccepted.replace(
        "{company}",
        item.metadata.companyName ?? "",
      );
    case "company_invite_declined":
      return dict.actions.companyInviteDeclined.replace(
        "{company}",
        item.metadata.companyName ?? "",
      );
    case "company_verified":
      return dict.actions.companyVerified;
    case "company_member_left":
    case "company_member_removed":
    case "company_project_request":
    case "company_project_confirmed":
    case "company_project_declined": {
      const template = {
        company_member_left: dict.actions.companyMemberLeft,
        company_member_removed: dict.actions.companyMemberRemoved,
        company_project_request: dict.actions.companyProjectRequest,
        company_project_confirmed: dict.actions.companyProjectConfirmed,
        company_project_declined: dict.actions.companyProjectDeclined,
      }[item.type];
      return template
        .replace("{company}", item.metadata.companyName ?? "")
        .replace("{project}", item.metadata.projectTitle ?? "");
    }
    case "vacancy_approved":
    case "vacancy_expired":
      return (
        item.type === "vacancy_approved"
          ? dict.actions.vacancyApproved
          : dict.actions.vacancyExpired
      ).replace("{title}", item.metadata.vacancyTitle ?? "");
    case "application_received":
      return dict.actions.applicationReceived.replace(
        "{title}",
        item.metadata.vacancyTitle ?? "",
      );
    case "application_status": {
      const status = item.metadata.applicationStatus;
      return status
        ? dict.actions.applicationStatus[status].replace(
            "{title}",
            item.metadata.vacancyTitle ?? "",
          )
        : "";
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

  // Moderation removals delete the underlying content, so deep-linking to it
  // would 404. Send the owner to their space where the decision (and any
  // appeal path) is visible. Restrictions keep the content, so they fall
  // through to the normal target resolution below.
  if (
    item.type === "moderation_decision" &&
    item.metadata.moderationStatus === "removed"
  ) {
    return item.metadata.contentKind === "company"
      ? `${base}/my-space/companies`
      : item.metadata.contentKind === "vacancy"
        ? `${base}/my-space/vacancies`
        : `${base}/my-space`;
  }

  // A new application is read in the team's list for that vacancy; an answer
  // to one's own application, in "My applications".
  if (item.type === "application_received") {
    return item.metadata.vacancyId
      ? `${base}/my-space/vacancies/${item.metadata.vacancyId}`
      : `${base}/my-space/vacancies`;
  }

  if (item.type === "application_status") {
    return `${base}/my-space/applications`;
  }

  // An expired vacancy is extended from the team's list.
  if (item.type === "vacancy_expired") {
    return `${base}/my-space/vacancies`;
  }

  if (item.targetType === "vacancy") {
    return item.metadata.vacancySlug
      ? `${base}/jobs/${item.metadata.vacancySlug}`
      : `${base}/my-space/vacancies`;
  }

  // An invitation is answered where all of the person's companies are; the
  // other company events open the page itself.
  if (item.type === "company_invite") {
    return `${base}/my-space/companies`;
  }

  // A request is decided in the company's editor.
  if (item.type === "company_project_request" && item.metadata.companyId) {
    return `${base}/companies/edit/${item.metadata.companyId}`;
  }

  // A decision about a project opens the project.
  if (
    (item.type === "company_project_confirmed" || item.type === "company_project_declined") &&
    item.metadata.projectId
  ) {
    return `${base}/projects/${item.metadata.projectSlug || item.metadata.projectId}`;
  }

  if (item.targetType === "company") {
    return item.metadata.companySlug
      ? `${base}/companies/${item.metadata.companySlug}`
      : `${base}/my-space/companies`;
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
      return `${base}/my-space`;
    default:
      return `${base}/notifications`;
  }
}
