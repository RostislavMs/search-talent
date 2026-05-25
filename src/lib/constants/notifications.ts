export const NOTIFICATION_TYPES = [
  "mention",
  "new_comment",
  "comment_reply",
  "reaction",
  "new_follower",
  "new_badge",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TARGET_TYPES = [
  "project_comment",
  "article_comment",
  "article",
  "project",
  "profile",
  "badge",
] as const;

export type NotificationTargetType =
  (typeof NOTIFICATION_TARGET_TYPES)[number];

export type NotificationMetadata = {
  emoji?: string;
  excerpt?: string;
  articleSlug?: string;
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
