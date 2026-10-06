import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ModerationStatus,
  ReportStatus,
  ReportTargetType,
} from "@/lib/moderation";

export type AdminOverviewStats = {
  totalUsers: number;
  totalAdmins: number;
  totalProfiles: number;
  totalProjects: number;
  totalArticles: number;
  openReports: number;
  urgentReports: number;
  newFeedback: number;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [
    adminsResponse,
    profilesResponse,
    projectsResponse,
    articlesResponse,
    openReportsResponse,
    urgentReportsResponse,
    feedbackResponse,
  ] = await Promise.all([
    supabase.from("platform_admins").select("user_id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "triaged"]),
    supabase
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "triaged"])
      .eq("priority", "urgent"),
    supabase.from("feedback").select("id", { count: "exact", head: true }),
  ]);

  let totalUsers = profilesResponse.count || 0;

  if (adminClient) {
    const { data: usersList } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (usersList && "total" in usersList && typeof usersList.total === "number") {
      totalUsers = usersList.total;
    }
  }

  return {
    totalUsers,
    totalAdmins: adminsResponse.count || 0,
    totalProfiles: profilesResponse.count || 0,
    totalProjects: projectsResponse.count || 0,
    totalArticles: articlesResponse.count || 0,
    openReports: openReportsResponse.count || 0,
    urgentReports: urgentReportsResponse.count || 0,
    newFeedback: feedbackResponse.count || 0,
  };
}

export type AdminUserRow = {
  userId: string;
  profileId: string | null;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  moderationStatus: ModerationStatus | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
};

export type UsersListParams = {
  search?: string;
  role?: "all" | "admin" | "user";
  status?: "all" | ModerationStatus;
  page?: number;
  perPage?: number;
};

export type UsersListResult = {
  items: AdminUserRow[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  summary: {
    totalUsers: number;
    totalAdmins: number;
    newThisWeek: number;
  };
};

type AdminUsersListRpcRow = {
  userId: string;
  profileId: string | null;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  moderationStatus: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  isAdmin: boolean;
};

function normalizeStatus(value: string | null | undefined): ModerationStatus | null {
  const allowed: ModerationStatus[] = [
    "approved",
    "under_review",
    "restricted",
    "removed",
  ];
  return allowed.includes(value as ModerationStatus)
    ? (value as ModerationStatus)
    : null;
}

export async function getAdminUsersList(
  params: UsersListParams = {},
): Promise<UsersListResult> {
  const {
    search = "",
    role = "all",
    status = "all",
    page = 1,
    perPage = 25,
  } = params;

  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * perPage;

  // Filtering, sorting and pagination all run in SQL (admin_users_list joins
  // auth.users -> profiles -> platform_admins). The RPC is SECURITY DEFINER and
  // guarded by an admin check, so it returns emails only to platform admins.
  const { data } = await supabase.rpc("admin_users_list", {
    p_search: search,
    p_role: role,
    p_status: status,
    p_limit: perPage,
    p_offset: offset,
  });

  const payload = (data || {}) as {
    total?: number;
    summary?: { totalUsers: number; totalAdmins: number; newThisWeek: number };
    items?: AdminUsersListRpcRow[];
  };

  const items: AdminUserRow[] = (payload.items || []).map((row) => ({
    userId: row.userId,
    profileId: row.profileId ?? null,
    email: row.email ?? null,
    displayName: row.displayName ?? null,
    username: row.username ?? null,
    avatarUrl: row.avatarUrl ?? null,
    moderationStatus: normalizeStatus(row.moderationStatus),
    createdAt: row.createdAt ?? null,
    lastSignInAt: row.lastSignInAt ?? null,
    isAdmin: Boolean(row.isAdmin),
  }));

  const total = payload.total ?? 0;

  return {
    items,
    total,
    page: safePage,
    perPage,
    hasMore: offset + items.length < total,
    summary: {
      totalUsers: payload.summary?.totalUsers ?? 0,
      totalAdmins: payload.summary?.totalAdmins ?? 0,
      newThisWeek: payload.summary?.newThisWeek ?? 0,
    },
  };
}

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actionType: string;
  previousStatus: ModerationStatus | null;
  nextStatus: ModerationStatus | null;
  reportStatus: ReportStatus | null;
  targetType: ReportTargetType;
  targetId: string | null;
  targetLabel: string;
  targetHref: string | null;
  /** Null when no person decided: auto-moderation, a report, the system. */
  actorLabel: string | null;
  actorUserId: string | null;
  source: "admin" | "auto" | "report" | "system";
  note: string | null;
};

export type AuditLogParams = {
  action?: string | "all";
  target?: ReportTargetType | "all";
  limit?: number;
  before?: string | null;
};

export async function getAdminAuditLog(
  params: AuditLogParams = {},
): Promise<{ items: AuditLogEntry[]; hasMore: boolean }> {
  const { action = "all", target = "all", limit = 50, before = null } = params;

  const supabase = await createClient();

  let query = supabase
    .from("moderation_actions")
    .select(
      "id, created_at, action_type, previous_status, next_status, report_status, target_type, target_profile_id, target_project_id, target_article_id, target_poll_id, target_company_id, target_vacancy_id, target_comment_id, actor_user_id, source, note",
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (action !== "all") {
    query = query.eq("action_type", action);
  }

  if (target !== "all") {
    query = query.eq("target_type", target);
  }

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { items: [], hasMore: false };
  }

  type ActionRow = {
    id: string;
    created_at: string;
    action_type: string;
    previous_status: string | null;
    next_status: string | null;
    report_status: string | null;
    target_type: ReportTargetType;
    target_profile_id: string | null;
    target_project_id: string | null;
    target_article_id: string | null;
    target_company_id?: string | null;
    target_vacancy_id?: string | null;
    target_poll_id?: string | null;
    target_comment_id?: string | null;
    actor_user_id: string | null;
    source?: string | null;
    note: string | null;
  };

  const rows = data as ActionRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const actorIds = Array.from(
    new Set(pageRows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))),
  );
  const pollIds = Array.from(
    new Set(
      pageRows
        .map((row) => row.target_poll_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const profileIds = Array.from(
    new Set(
      pageRows
        .map((row) => row.target_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const projectIds = Array.from(
    new Set(
      pageRows
        .map((row) => row.target_project_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const articleIds = Array.from(
    new Set(
      pageRows
        .map((row) => row.target_article_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const companyIds = Array.from(
    new Set(
      pageRows
        .map((row) => row.target_company_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const vacancyIds = Array.from(
    new Set(
      pageRows
        .map((row) => row.target_vacancy_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [
    actorsResponse,
    profilesResponse,
    projectsResponse,
    articlesResponse,
    companiesResponse,
    vacanciesResponse,
    pollsResponse,
  ] =
    await Promise.all([
      actorIds.length
        ? supabase
            .from("profiles")
            .select("user_id, name, username")
            .in("user_id", actorIds)
        : Promise.resolve({ data: [] as { user_id: string; name: string | null; username: string | null }[] }),
      profileIds.length
        ? supabase
            .from("profiles")
            .select("id, name, username")
            .in("id", profileIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; username: string | null }[] }),
      projectIds.length
        ? supabase
            .from("projects")
            .select("id, title, slug")
            .in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string | null }[] }),
      articleIds.length
        ? supabase
            .from("articles")
            .select("id, title, slug")
            .in("id", articleIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
      companyIds.length
        ? supabase
            .from("companies")
            .select("id, name, slug")
            .in("id", companyIds)
        : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
      vacancyIds.length
        ? supabase
            .from("vacancies")
            .select("id, title, slug")
            .in("id", vacancyIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
      pollIds.length
        ? supabase
            .from("polls")
            .select("id, title, slug")
            .in("id", pollIds)
        : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
    ]);

  const actorMap = new Map(
    (actorsResponse.data || []).map((row) => [
      row.user_id,
      row.name || (row.username ? `@${row.username}` : row.user_id),
    ]),
  );
  const profileMap = new Map(
    (profilesResponse.data || []).map((row) => [
      row.id,
      {
        label: row.name || (row.username ? `@${row.username}` : row.id),
        href: row.username ? `/u/${row.username}` : null,
      },
    ]),
  );
  const projectMap = new Map(
    (projectsResponse.data || []).map((row) => [
      row.id,
      {
        label: row.title,
        href: row.slug ? `/projects/${row.slug}` : null,
      },
    ]),
  );
  const articleMap = new Map(
    (articlesResponse.data || []).map((row) => [
      row.id,
      {
        label: row.title,
        href: row.slug ? `/articles/${row.slug}` : null,
      },
    ]),
  );

  const companyMap = new Map(
    ((companiesResponse.data || []) as { id: string; name: string; slug: string }[]).map((row) => [
      row.id,
      { label: row.name, href: `/companies/${row.slug}` },
    ]),
  );
  const vacancyMap = new Map(
    ((vacanciesResponse.data || []) as { id: string; title: string; slug: string }[]).map((row) => [
      row.id,
      { label: row.title, href: `/jobs/${row.slug}` },
    ]),
  );

  const pollMap = new Map(
    ((pollsResponse.data || []) as { id: string; title: string; slug: string }[]).map((row) => [
      row.id,
      { label: row.title, href: `/polls/${row.slug}` },
    ]),
  );

  const items: AuditLogEntry[] = pageRows.map((row) => {
    let targetId: string | null = null;
    let targetLabel = "—";
    let targetHref: string | null = null;

    if (row.target_type === "profile" && row.target_profile_id) {
      targetId = row.target_profile_id;
      const profile = profileMap.get(row.target_profile_id);
      targetLabel = profile?.label || row.target_profile_id;
      targetHref = profile?.href || null;
    } else if (row.target_type === "project" && row.target_project_id) {
      targetId = row.target_project_id;
      const project = projectMap.get(row.target_project_id);
      targetLabel = project?.label || row.target_project_id;
      targetHref = project?.href || null;
    } else if (row.target_type === "article" && row.target_article_id) {
      targetId = row.target_article_id;
      const article = articleMap.get(row.target_article_id);
      targetLabel = article?.label || row.target_article_id;
      targetHref = article?.href || null;
    } else if (row.target_type === "company" && row.target_company_id) {
      targetId = row.target_company_id;
      const company = companyMap.get(row.target_company_id);
      targetLabel = company?.label || row.target_company_id;
      targetHref = company?.href || null;
    } else if (row.target_type === "vacancy" && row.target_vacancy_id) {
      targetId = row.target_vacancy_id;
      const vacancy = vacancyMap.get(row.target_vacancy_id);
      targetLabel = vacancy?.label || row.target_vacancy_id;
      targetHref = vacancy?.href || null;
    } else if (row.target_type === "poll" && row.target_poll_id) {
      targetId = row.target_poll_id;
      const poll = pollMap.get(row.target_poll_id);
      targetLabel = poll?.label || row.target_poll_id;
      targetHref = poll?.href || null;
    } else if (row.target_comment_id) {
      // A removed comment is gone (it waits in the trash); its id is what is left.
      targetId = row.target_comment_id;
      targetLabel = `#${row.target_comment_id.slice(0, 8)}`;
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      actionType: row.action_type,
      previousStatus: normalizeStatus(row.previous_status),
      nextStatus: normalizeStatus(row.next_status),
      reportStatus: (row.report_status as ReportStatus) || null,
      targetType: row.target_type,
      targetId,
      targetLabel,
      targetHref,
      actorLabel: row.actor_user_id ? actorMap.get(row.actor_user_id) || row.actor_user_id : null,
      actorUserId: row.actor_user_id,
      source:
        row.source === "auto" || row.source === "report" || row.source === "system"
          ? row.source
          : "admin",
      note: row.note,
    };
  });

  return { items, hasMore };
}
