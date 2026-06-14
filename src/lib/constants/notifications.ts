export const NOTIFICATION_TYPES = [
  "mention",
  "new_comment",
  "comment_reply",
  "reaction",
  "new_follower",
  "new_badge",
  "moderation_decision",
  "new_content",
  "co_author_invite",
  "co_author_accepted",
  "co_author_declined",
  "co_author_published",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TARGET_TYPES = [
  "project_comment",
  "article_comment",
  "poll_comment",
  "article",
  "project",
  "poll",
  "profile",
  "badge",
] as const;

export type NotificationTargetType =
  (typeof NOTIFICATION_TARGET_TYPES)[number];

export type NotificationMetadata = {
  emoji?: string;
  excerpt?: string;
  articleSlug?: string;
  pollSlug?: string;
  projectId?: string;
  actorName?: string;
  actorUsername?: string | null;
  actorAvatarUrl?: string | null;
  badgeId?: number;
  badgeKey?: string;
  badgeNameEn?: string;
  badgeNameUk?: string;
  badgeEmoji?: string;
  badgeCategory?: string;
  badgeRarity?: string;
  badgeTier?: number;
  /** Recipient's public profile username — used to deep-link badge notifications to /u/<username>. */
  profileUsername?: string | null;
  /** Moderation notifications: the decision applied to the recipient's content. */
  moderationStatus?: "removed" | "restricted";
  /** Moderation notifications: which kind of content was actioned. */
  contentKind?: "article" | "project" | "profile" | "poll";
  /** Moderation notifications: human-readable title of the actioned content. */
  contentTitle?: string;
  /** Co-author notifications: the invitation (junction row) id to accept/decline. */
  invitationId?: string;
  /** Co-author notifications: which content type the invitation targets. */
  coAuthorContentType?: "project" | "article" | "poll";
  /** Co-author notifications: slug used to deep-link to the content. */
  coAuthorContentSlug?: string;
  /** Co-author notifications: title of the shared work. */
  coAuthorContentTitle?: string;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  recipientUserId: string;
  actorUserId: string | null;
  targetType: NotificationTargetType | null;
  targetId: string | null;
  metadata: NotificationMetadata;
  readAt: string | null;
  createdAt: string;
};

export const NOTIFICATIONS_PAGE_SIZE = 30;
export const NOTIFICATIONS_POLL_INTERVAL_MS = 45_000;
