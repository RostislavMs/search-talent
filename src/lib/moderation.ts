export const moderationStatuses = [
  "approved",
  "under_review",
  "restricted",
  "removed",
] as const;

export const reportTargetTypes = ["profile", "project", "article", "company", "vacancy"] as const;

/**
 * Where each target lives: its table and its column in content_reports and
 * moderation_actions. Every route that reads or writes a target goes through
 * this map, so a new type cannot quietly land on the projects table.
 */
export const REPORT_TARGETS = {
  profile: { table: "profiles", column: "target_profile_id" },
  project: { table: "projects", column: "target_project_id" },
  article: { table: "articles", column: "target_article_id" },
  company: { table: "companies", column: "target_company_id" },
  vacancy: { table: "vacancies", column: "target_vacancy_id" },
} as const satisfies Record<string, { table: string; column: string }>;

/**
 * The target column of a report or a moderation action. Only that one is
 * written: the others default to null, and naming a column the database does
 * not have yet would fail every insert.
 */
export function reportTargetColumns(type: ReportTargetType, id: string): Record<string, string> {
  return { [REPORT_TARGETS[type].column]: id };
}

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
export type ReportReason = (typeof reportReasons)[number];
export type ReportStatus = (typeof reportStatuses)[number];
export type ModerationPriority = (typeof moderationPriorities)[number];

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

/**
 * Whether a new report takes the target off public view at once, before a
 * moderator looks. For vacancies a scam report counts too: a fake job hurts
 * the people who answer it, so it waits for a decision hidden.
 */
export function reportHoldsTarget(targetType: ReportTargetType, reason: ReportReason): boolean {
  if (targetType === "vacancy" && reason === "spam_or_scam") {
    return true;
  }
  return getReportPriority(reason) === "urgent";
}

export function getReportPriority(reason: ReportReason): ModerationPriority {
  switch (reason) {
    case "sexual_content":
    case "harmful_or_dangerous":
    case "harassment_or_hate":
      return "urgent";
    case "copyright_infringement":
    case "impersonation":
    case "spam_or_scam":
      return "high";
    default:
      return "normal";
  }
}

export function getModerationActionType(
  currentStatus: ModerationStatus | null,
  nextStatus: ModerationStatus,
) {
  if (currentStatus === nextStatus) {
    return nextStatus === "approved" ? "confirm_approved" : "update_status";
  }

  switch (nextStatus) {
    case "approved":
      return currentStatus === "removed" || currentStatus === "restricted"
        ? "restore"
        : "approve";
    case "under_review":
      return "send_to_review";
    case "restricted":
      return "restrict";
    case "removed":
      return "remove";
    default:
      return "update_status";
  }
}
