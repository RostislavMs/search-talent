export const moderationStatuses = [
  "approved",
  "under_review",
  "restricted",
  "removed",
] as const;

export const commentReportTargetTypes = [
  "project_comment",
  "article_comment",
  "poll_comment",
] as const;

export const reportTargetTypes = [
  "profile",
  "project",
  "article",
  "poll",
  "company",
  "vacancy",
  ...commentReportTargetTypes,
] as const;

/**
 * Where each target lives: its table and its column in content_reports and
 * moderation_actions. Comments share one column (they have no foreign key: a
 * removed comment's log entry outlives it); the type says which table.
 */
export const REPORT_TARGETS = {
  profile: { table: "profiles", column: "target_profile_id" },
  project: { table: "projects", column: "target_project_id" },
  article: { table: "articles", column: "target_article_id" },
  poll: { table: "polls", column: "target_poll_id" },
  company: { table: "companies", column: "target_company_id" },
  vacancy: { table: "vacancies", column: "target_vacancy_id" },
  project_comment: { table: "project_comments", column: "target_comment_id" },
  article_comment: { table: "article_comments", column: "target_comment_id" },
  poll_comment: { table: "poll_comments", column: "target_comment_id" },
} as const satisfies Record<string, { table: string; column: string }>;

/** The admin content tables work with these only (bulk status and delete). */
export const bulkModerationTargetTypes = ["profile", "project", "article"] as const;

export const reportReasons = [
  "copyright_infringement",
  "inappropriate_content",
  "harmful_or_dangerous",
  "sexual_content",
  "harassment_or_hate",
  "spam_or_scam",
  "impersonation",
  "other",
] as const;

export const reportStatuses = ["open", "triaged", "resolved", "dismissed"] as const;
export const moderationPriorities = ["normal", "high", "urgent"] as const;

export type ModerationStatus = (typeof moderationStatuses)[number];
export type ReportTargetType = (typeof reportTargetTypes)[number];
export type CommentReportTargetType = (typeof commentReportTargetTypes)[number];
export type ReportReason = (typeof reportReasons)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type ModerationPriority = (typeof moderationPriorities)[number];

/** A comment has no review status: a moderator keeps it or removes it. */
export function isCommentReportTarget(type: ReportTargetType): type is CommentReportTargetType {
  return (commentReportTargetTypes as readonly string[]).includes(type);
}

export function normalizeModerationStatus(
  value: string | null | undefined,
): ModerationStatus | null {
  return moderationStatuses.includes(value as ModerationStatus)
    ? (value as ModerationStatus)
    : null;
}

export function isPublicModerationStatus(value: string | null | undefined) {
  const normalized = normalizeModerationStatus(value);
  return normalized === null || normalized === "approved";
}
