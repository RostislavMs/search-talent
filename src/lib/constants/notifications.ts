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
  "company_invite",
  "company_invite_accepted",
  "company_invite_declined",
  "company_verified",
  "company_member_left",
  "company_member_removed",
  "company_project_request",
  "company_project_confirmed",
  "company_project_declined",
  "vacancy_approved",
  "vacancy_expired",
  "application_received",
  "application_status",
  "vacancy_match",
  "company_contact_opened",
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
  "company",
  "vacancy",
  "vacancy_application",
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
  contentKind?: "article" | "project" | "profile" | "poll" | "company" | "vacancy";
  /** Moderation notifications: human-readable title of the actioned content. */
  contentTitle?: string;
  /** Co-author and company invitations: the invitation row id to accept/decline. */
  invitationId?: string;
  /** Co-author notifications: which content type the invitation targets. */
  coAuthorContentType?: "project" | "article" | "poll";
  /** Co-author notifications: slug used to deep-link to the content. */
  coAuthorContentSlug?: string;
  /** Co-author notifications: title of the shared work. */
  coAuthorContentTitle?: string;
  /** Company notifications: the page the event is about. */
  companyId?: string;
  companySlug?: string;
  companyName?: string;
  /** Company invitations: the role offered. */
  companyRole?: "owner" | "admin" | "recruiter";
  /** Company project requests and decisions: the project concerned. */
  projectTitle?: string;
  projectSlug?: string;
  /** Vacancy notifications: the vacancy concerned. */
  vacancyId?: string;
  vacancySlug?: string;
  vacancyTitle?: string;
  /** Application notifications: the application concerned. */
  applicationId?: string;
  /** Application status notifications: what the team did. */
  applicationStatus?: "viewed" | "shortlisted" | "rejected" | "hired";
  /** Job alerts: how many new vacancies the morning run found. */
  matchCount?: number;
  /** Job alerts: the followed search, when only one found something. */
  searchName?: string;
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
