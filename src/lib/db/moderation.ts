import { buildCompanyPath } from "@/lib/companies";
import { buildProjectPath } from "@/lib/projects";
import { buildVacancyPath } from "@/lib/vacancies";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeModerationStatus,
  type ModerationPriority,
  type ModerationStatus,
  type ReportReason,
  type ReportStatus,
  type ReportTargetType,
} from "@/lib/moderation";
import { getCurrentViewerRole } from "@/lib/moderation-server";

type QueueReportRow = {
  id: string;
  target_type: ReportTargetType;
  target_profile_id: string | null;
  target_project_id: string | null;
  target_article_id: string | null;
  target_company_id: string | null;
  target_vacancy_id: string | null;
  target_owner_user_id: string | null;
  reporter_user_id: string;
  reason: ReportReason;
  details: string | null;
  priority: ModerationPriority;
  status: ReportStatus;
  created_at: string;
  resolution_note: string | null;
};

type ProfileTargetRow = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  moderation_status: string | null;
};

type ProjectTargetRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  moderation_status: string | null;
};

type ArticleTargetRow = {
  id: string;
  author_user_id: string;
  title: string;
  slug: string;
  moderation_status: string | null;
};

type NamedTargetRow = {
  id: string;
  slug: string;
  name?: string;
  title?: string;
  moderation_status: string | null;
};

type IdentityProfileRow = {
  user_id: string;
  username: string | null;
  name: string | null;
};

export type ModerationQueueItem = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  targetHref: string | null;
  targetStatus: ModerationStatus | null;
  reportReason: ReportReason;
  reportStatus: ReportStatus;
  priority: ModerationPriority;
  details: string | null;
  createdAt: string;
  reporterLabel: string;
  ownerLabel: string;
  resolutionNote: string | null;
};

export async function getModerationQueue() {
  const { user, isAdmin } = await getCurrentViewerRole();

  if (!user || !isAdmin) {
    return null;
  }

  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("content_reports")
    .select(
      "id, target_type, target_profile_id, target_project_id, target_article_id, target_company_id, target_vacancy_id, target_owner_user_id, reporter_user_id, reason, details, priority, status, created_at, resolution_note",
    )
    .in("status", ["open", "triaged"])
    .order("status", { ascending: true })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(80);

  const queueRows = (reports || []) as QueueReportRow[];
  const profileIds = queueRows
    .map((item) => item.target_profile_id)
    .filter((item): item is string => Boolean(item));
  const projectIds = queueRows
    .map((item) => item.target_project_id)
    .filter((item): item is string => Boolean(item));
  const articleIds = queueRows
    .map((item) => item.target_article_id)
    .filter((item): item is string => Boolean(item));
  const companyIds = queueRows
    .map((item) => item.target_company_id)
    .filter((item): item is string => Boolean(item));
  const vacancyIds = queueRows
    .map((item) => item.target_vacancy_id)
    .filter((item): item is string => Boolean(item));
  const identityIds = [...new Set(
    queueRows
      .flatMap((item) => [item.reporter_user_id, item.target_owner_user_id])
      .filter(Boolean),
  )] as string[];

  const [
    profileTargetsResponse,
    projectTargetsResponse,
    articleTargetsResponse,
    identityProfilesResponse,
    companyTargetsResponse,
    vacancyTargetsResponse,
  ] =
    await Promise.all([
      profileIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, user_id, username, name, moderation_status")
            .in("id", profileIds)
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? supabase
            .from("projects")
            .select("id, owner_id, title, slug, moderation_status")
            .in("id", projectIds)
        : Promise.resolve({ data: [] }),
      articleIds.length > 0
        ? supabase
            .from("articles")
            .select("id, author_user_id, title, slug, moderation_status")
            .in("id", articleIds)
        : Promise.resolve({ data: [] }),
      identityIds.length > 0
        ? supabase
            .from("profiles")
            .select("user_id, username, name")
            .in("user_id", identityIds)
        : Promise.resolve({ data: [] }),
      companyIds.length > 0
        ? supabase
            .from("companies")
            .select("id, slug, name, moderation_status")
            .in("id", companyIds)
        : Promise.resolve({ data: [] }),
      vacancyIds.length > 0
        ? supabase
            .from("vacancies")
            .select("id, slug, title, moderation_status")
            .in("id", vacancyIds)
        : Promise.resolve({ data: [] }),
    ]);

  const profileTargets = new Map(
    ((profileTargetsResponse.data || []) as ProfileTargetRow[]).map((item) => [item.id, item]),
  );
  const projectTargets = new Map(
    ((projectTargetsResponse.data || []) as ProjectTargetRow[]).map((item) => [item.id, item]),
  );
  const articleTargets = new Map(
    ((articleTargetsResponse.data || []) as ArticleTargetRow[]).map((item) => [item.id, item]),
  );
  const identityProfiles = new Map(
    ((identityProfilesResponse.data || []) as IdentityProfileRow[]).map((item) => [
      item.user_id,
      item,
    ]),
  );
  const companyTargets = new Map(
    ((companyTargetsResponse.data || []) as NamedTargetRow[]).map((item) => [item.id, item]),
  );
  const vacancyTargets = new Map(
    ((vacancyTargetsResponse.data || []) as NamedTargetRow[]).map((item) => [item.id, item]),
  );

  const priorityRank: Record<ModerationPriority, number> = {
    urgent: 3,
    high: 2,
    normal: 1,
  };
  const reportStatusRank: Record<ReportStatus, number> = {
    open: 2,
    triaged: 1,
    resolved: 0,
    dismissed: 0,
  };

  const queue = queueRows.map<ModerationQueueItem>((report) => {
    const reporterIdentity = identityProfiles.get(report.reporter_user_id);
    const ownerIdentity = report.target_owner_user_id
      ? identityProfiles.get(report.target_owner_user_id)
      : null;
    const reporterLabel =
      reporterIdentity?.name ||
      (reporterIdentity?.username ? `@${reporterIdentity.username}` : report.reporter_user_id);
    const ownerLabel =
      ownerIdentity?.name ||
      (ownerIdentity?.username
        ? `@${ownerIdentity.username}`
        : report.target_owner_user_id || "Unknown");

    if (report.target_type === "profile") {
      const target = report.target_profile_id
        ? profileTargets.get(report.target_profile_id)
        : null;

      return {
        id: report.id,
        targetType: report.target_type,
        targetId: target?.id || report.target_profile_id || "",
        targetLabel:
          target?.name ||
          (target?.username ? `@${target.username}` : report.target_profile_id || "Profile"),
        targetHref: target?.username ? `/u/${target.username}` : null,
        targetStatus: normalizeModerationStatus(target?.moderation_status),
        reportReason: report.reason,
        reportStatus: report.status,
        priority: report.priority,
        details: report.details,
        createdAt: report.created_at,
        reporterLabel,
        ownerLabel,
        resolutionNote: report.resolution_note,
      };
    }

    if (report.target_type === "company" || report.target_type === "vacancy") {
      const isCompany = report.target_type === "company";
      const rawId = isCompany ? report.target_company_id : report.target_vacancy_id;
      const target = rawId
        ? (isCompany ? companyTargets : vacancyTargets).get(rawId)
        : null;

      return {
        id: report.id,
        targetType: report.target_type,
        targetId: target?.id || rawId || "",
        targetLabel: target?.name || target?.title || rawId || (isCompany ? "Company" : "Vacancy"),
        targetHref: target?.slug
          ? isCompany
            ? buildCompanyPath(target.slug)
            : buildVacancyPath(target.slug)
          : null,
        targetStatus: normalizeModerationStatus(target?.moderation_status),
        reportReason: report.reason,
        reportStatus: report.status,
        priority: report.priority,
        details: report.details,
        createdAt: report.created_at,
        reporterLabel,
        ownerLabel,
        resolutionNote: report.resolution_note,
      };
    }

    if (report.target_type === "article") {
      const target = report.target_article_id
        ? articleTargets.get(report.target_article_id)
        : null;

      return {
        id: report.id,
        targetType: report.target_type,
        targetId: target?.id || report.target_article_id || "",
        targetLabel: target?.title || report.target_article_id || "Article",
        targetHref: target?.slug ? `/articles/${target.slug}` : null,
        targetStatus: normalizeModerationStatus(target?.moderation_status),
        reportReason: report.reason,
        reportStatus: report.status,
        priority: report.priority,
        details: report.details,
        createdAt: report.created_at,
        reporterLabel,
        ownerLabel,
        resolutionNote: report.resolution_note,
      };
    }

    const target = report.target_project_id
      ? projectTargets.get(report.target_project_id)
      : null;

    return {
      id: report.id,
      targetType: report.target_type,
      targetId: target?.id || report.target_project_id || "",
      targetLabel: target?.title || report.target_project_id || "Project",
      targetHref: target ? buildProjectPath(target.id, target.slug) : null,
      targetStatus: normalizeModerationStatus(target?.moderation_status),
      reportReason: report.reason,
      reportStatus: report.status,
      priority: report.priority,
      details: report.details,
      createdAt: report.created_at,
      reporterLabel,
      ownerLabel,
      resolutionNote: report.resolution_note,
    };
  });

  const orderedQueue = queue.sort(
    (left, right) =>
      reportStatusRank[right.reportStatus] - reportStatusRank[left.reportStatus] ||
      priorityRank[right.priority] - priorityRank[left.priority] ||
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  return {
    items: orderedQueue,
    summary: {
      active: orderedQueue.length,
      urgent: orderedQueue.filter((item) => item.priority === "urgent").length,
      profiles: orderedQueue.filter((item) => item.targetType === "profile").length,
      projects: orderedQueue.filter((item) => item.targetType === "project").length,
      articles: orderedQueue.filter((item) => item.targetType === "article").length,
      hiring: orderedQueue.filter(
        (item) => item.targetType === "company" || item.targetType === "vacancy",
      ).length,
    },
  };
}
