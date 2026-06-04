import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProjectPath } from "@/lib/projects";
import type { ModerationStatus } from "@/lib/moderation";

const PER_PAGE = 25;

type ContentFilterParams = {
  search?: string;
  status?: "all" | ModerationStatus;
  page?: number;
  perPage?: number;
};

export type AdminArticleRow = {
  id: string;
  title: string;
  slug: string;
  createdAt: string;
  moderationStatus: ModerationStatus | null;
  authorUserId: string;
  authorLabel: string;
  authorHref: string | null;
  likes: number;
  commentsCount: number;
};

export type AdminContentStatusCounts = {
  approved: number;
  under_review: number;
  restricted: number;
  removed: number;
};

export type AdminArticlesList = {
  items: AdminArticleRow[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  statusCounts: AdminContentStatusCounts;
};

function normalizeStatus(value: string | null | undefined): ModerationStatus | null {
  const allowed: ModerationStatus[] = ["approved", "under_review", "restricted", "removed"];
  return allowed.includes(value as ModerationStatus) ? (value as ModerationStatus) : null;
}

async function getProfilesByUserIds(userIds: string[]) {
  if (!userIds.length) return new Map<string, { name: string | null; username: string | null }>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, username")
    .in("user_id", userIds);
  return new Map(
    ((data || []) as { user_id: string; name: string | null; username: string | null }[]).map(
      (row) => [row.user_id, { name: row.name, username: row.username }],
    ),
  );
}

async function getStatusCounts(
  table: "articles" | "projects",
): Promise<AdminContentStatusCounts> {
  const supabase = await createClient();
  const counts: AdminContentStatusCounts = {
    approved: 0,
    under_review: 0,
    restricted: 0,
    removed: 0,
  };
  const statuses: Array<keyof AdminContentStatusCounts> = [
    "approved",
    "under_review",
    "restricted",
    "removed",
  ];

  await Promise.all(
    statuses.map(async (status) => {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", status);
      counts[status] = count || 0;
    }),
  );

  return counts;
}

function authorLabel(profile: { name: string | null; username: string | null } | undefined) {
  if (!profile) return "—";
  return profile.name || (profile.username ? `@${profile.username}` : "—");
}

function authorHref(profile: { username: string | null } | undefined) {
  return profile?.username ? `/u/${profile.username}` : null;
}

export async function getAdminArticlesList(
  params: ContentFilterParams = {},
): Promise<AdminArticlesList> {
  const {
    search = "",
    status = "all",
    page = 1,
    perPage = PER_PAGE,
  } = params;

  const supabase = await createClient();
  const offset = (Math.max(1, page) - 1) * perPage;

  let query = supabase
    .from("articles")
    .select(
      "id, title, slug, created_at, moderation_status, author_user_id, likes_count, comments_count",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status !== "all") {
    query = query.eq("moderation_status", status);
  }

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, count } = await query;
  type Row = {
    id: string;
    title: string;
    slug: string;
    created_at: string;
    moderation_status: string | null;
    author_user_id: string;
    likes_count: number | null;
    comments_count: number | null;
  };
  const rows = (data || []) as Row[];

  const authorIds = Array.from(new Set(rows.map((row) => row.author_user_id)));
  const profileMap = await getProfilesByUserIds(authorIds);

  const items: AdminArticleRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    createdAt: row.created_at,
    moderationStatus: normalizeStatus(row.moderation_status),
    authorUserId: row.author_user_id,
    authorLabel: authorLabel(profileMap.get(row.author_user_id)),
    authorHref: authorHref(profileMap.get(row.author_user_id)),
    likes: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
  }));

  const total = count || 0;
  const statusCounts = await getStatusCounts("articles");

  return {
    items,
    total,
    page: Math.max(1, page),
    perPage,
    hasMore: offset + items.length < total,
    statusCounts,
  };
}

export type AdminProjectRow = {
  id: string;
  title: string;
  slug: string | null;
  path: string;
  createdAt: string;
  moderationStatus: ModerationStatus | null;
  ownerUserId: string;
  authorLabel: string;
  authorHref: string | null;
  likes: number;
  dislikes: number;
};

export type AdminProjectsList = {
  items: AdminProjectRow[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  statusCounts: AdminContentStatusCounts;
};

export async function getAdminProjectsList(
  params: ContentFilterParams = {},
): Promise<AdminProjectsList> {
  const {
    search = "",
    status = "all",
    page = 1,
    perPage = PER_PAGE,
  } = params;

  const supabase = await createClient();
  const offset = (Math.max(1, page) - 1) * perPage;

  let query = supabase
    .from("projects")
    .select(
      "id, title, slug, created_at, moderation_status, owner_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status !== "all") {
    query = query.eq("moderation_status", status);
  }

  if (search.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const { data, count } = await query;
  type Row = {
    id: string;
    title: string;
    slug: string | null;
    created_at: string;
    moderation_status: string | null;
    owner_id: string;
  };
  const rows = (data || []) as Row[];

  const ownerIds = Array.from(new Set(rows.map((row) => row.owner_id)));
  const profileMap = await getProfilesByUserIds(ownerIds);

  const projectIds = rows.map((row) => row.id);
  const votesResponse = projectIds.length
    ? await supabase
        .from("votes")
        .select("project_id, value")
        .in("project_id", projectIds)
    : { data: [] as { project_id: string; value: number | null }[] };

  const likeCounts = new Map<string, number>();
  const dislikeCounts = new Map<string, number>();
  for (const row of (votesResponse.data || []) as {
    project_id: string;
    value: number | null;
  }[]) {
    if (row.value === 1) {
      likeCounts.set(row.project_id, (likeCounts.get(row.project_id) || 0) + 1);
    } else if (row.value === -1) {
      dislikeCounts.set(row.project_id, (dislikeCounts.get(row.project_id) || 0) + 1);
    }
  }

  const items: AdminProjectRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    path: buildProjectPath(row.id, row.slug),
    createdAt: row.created_at,
    moderationStatus: normalizeStatus(row.moderation_status),
    ownerUserId: row.owner_id,
    authorLabel: authorLabel(profileMap.get(row.owner_id)),
    authorHref: authorHref(profileMap.get(row.owner_id)),
    likes: likeCounts.get(row.id) || 0,
    dislikes: dislikeCounts.get(row.id) || 0,
  }));

  const total = count || 0;
  const statusCounts = await getStatusCounts("projects");

  return {
    items,
    total,
    page: Math.max(1, page),
    perPage,
    hasMore: offset + items.length < total,
    statusCounts,
  };
}

export type AdminCommentRow = {
  id: string;
  kind: "article" | "project";
  body: string;
  createdAt: string;
  authorUserId: string;
  authorLabel: string;
  authorHref: string | null;
  targetLabel: string;
  targetHref: string | null;
};

export type AdminCommentsList = {
  items: AdminCommentRow[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
};

export async function getAdminCommentsList(
  params: {
    kind?: "all" | "article" | "project";
    page?: number;
    perPage?: number;
  } = {},
): Promise<AdminCommentsList> {
  const { kind = "all", page = 1, perPage = PER_PAGE } = params;
  const supabase = await createClient();

  const fetchArticleComments = kind !== "project";
  const fetchProjectComments = kind !== "article";

  const [articleResponse, projectResponse] = await Promise.all([
    fetchArticleComments
      ? supabase
          .from("article_comments")
          .select("id, article_id, author_user_id, body, created_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({
          data: [] as {
            id: string;
            article_id: string;
            author_user_id: string;
            body: string;
            created_at: string;
          }[],
          count: 0,
        }),
    fetchProjectComments
      ? supabase
          .from("project_comments")
          .select("id, project_id, author_user_id, body, created_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({
          data: [] as {
            id: string;
            project_id: string;
            author_user_id: string;
            body: string;
            created_at: string;
          }[],
          count: 0,
        }),
  ]);

  type ArticleCommentRow = {
    id: string;
    article_id: string;
    author_user_id: string;
    body: string;
    created_at: string;
  };
  type ProjectCommentRow = {
    id: string;
    project_id: string;
    author_user_id: string;
    body: string;
    created_at: string;
  };

  const articleRows = (articleResponse.data || []) as ArticleCommentRow[];
  const projectRows = (projectResponse.data || []) as ProjectCommentRow[];

  const articleIds = Array.from(new Set(articleRows.map((row) => row.article_id)));
  const projectIds = Array.from(new Set(projectRows.map((row) => row.project_id)));
  const authorIds = Array.from(
    new Set([
      ...articleRows.map((row) => row.author_user_id),
      ...projectRows.map((row) => row.author_user_id),
    ]),
  );

  const [articleTargetsResponse, projectTargetsResponse, profileMap] =
    await Promise.all([
      articleIds.length
        ? supabase
            .from("articles")
            .select("id, title, slug")
            .in("id", articleIds)
        : Promise.resolve({
            data: [] as { id: string; title: string; slug: string }[],
          }),
      projectIds.length
        ? supabase
            .from("projects")
            .select("id, title, slug")
            .in("id", projectIds)
        : Promise.resolve({
            data: [] as { id: string; title: string; slug: string | null }[],
          }),
      getProfilesByUserIds(authorIds),
    ]);

  const articleTargetMap = new Map(
    (articleTargetsResponse.data || []).map((row) => [
      row.id,
      {
        label: row.title,
        href: row.slug ? `/articles/${row.slug}` : null,
      },
    ]),
  );
  const projectTargetMap = new Map(
    (projectTargetsResponse.data || []).map((row) => [
      row.id,
      {
        label: row.title,
        href: buildProjectPath(row.id, row.slug),
      },
    ]),
  );

  const combined: AdminCommentRow[] = [
    ...articleRows.map<AdminCommentRow>((row) => {
      const target = articleTargetMap.get(row.article_id);
      return {
        id: row.id,
        kind: "article",
        body: row.body,
        createdAt: row.created_at,
        authorUserId: row.author_user_id,
        authorLabel: authorLabel(profileMap.get(row.author_user_id)),
        authorHref: authorHref(profileMap.get(row.author_user_id)),
        targetLabel: target?.label || "—",
        targetHref: target?.href || null,
      };
    }),
    ...projectRows.map<AdminCommentRow>((row) => {
      const target = projectTargetMap.get(row.project_id);
      return {
        id: row.id,
        kind: "project",
        body: row.body,
        createdAt: row.created_at,
        authorUserId: row.author_user_id,
        authorLabel: authorLabel(profileMap.get(row.author_user_id)),
        authorHref: authorHref(profileMap.get(row.author_user_id)),
        targetLabel: target?.label || "—",
        targetHref: target?.href || null,
      };
    }),
  ];

  combined.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const total =
    (articleResponse.count || 0) + (projectResponse.count || 0);
  const offset = (Math.max(1, page) - 1) * perPage;
  const items = combined.slice(offset, offset + perPage);

  return {
    items,
    total,
    page: Math.max(1, page),
    perPage,
    hasMore: offset + items.length < total,
  };
}

export type AdminUserDetail = {
  userId: string;
  profileId: string | null;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  countryId: number | null;
  countryName: string | null;
  moderationStatus: ModerationStatus | null;
  isAdmin: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  counts: {
    projects: number;
    articles: number;
    comments: number;
  };
  projects: Array<{
    id: string;
    title: string;
    path: string;
    moderationStatus: ModerationStatus | null;
    createdAt: string;
  }>;
  articles: Array<{
    id: string;
    title: string;
    slug: string;
    moderationStatus: ModerationStatus | null;
    createdAt: string;
  }>;
  auditActions: Array<{
    id: string;
    createdAt: string;
    actionType: string;
    actorLabel: string;
    note: string | null;
  }>;
};

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  let email: string | null = null;
  let authCreatedAt: string | null = null;
  let lastSignInAt: string | null = null;

  if (adminClient) {
    const { data, error } = await adminClient.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      return null;
    }
    email = data.user.email || null;
    authCreatedAt = data.user.created_at || null;
    lastSignInAt = data.user.last_sign_in_at || null;
  }

  const [
    profileResponse,
    adminResponse,
    projectsResponse,
    articlesResponse,
    articleCommentsResponse,
    projectCommentsResponse,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, user_id, name, username, avatar_url, bio, headline, country_id, moderation_status, created_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, title, slug, moderation_status, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("articles")
      .select("id, title, slug, moderation_status, created_at")
      .eq("author_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("article_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_user_id", userId),
    supabase
      .from("project_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_user_id", userId),
  ]);

  type ProfileDetailRow = {
    id: string;
    user_id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
    headline: string | null;
    country_id: number | null;
    moderation_status: string | null;
    created_at: string | null;
  };

  const profile = (profileResponse.data as ProfileDetailRow | null) || null;

  if (!profile && !email) {
    return null;
  }

  const profileId = profile?.id || null;
  const orFilters = [`actor_user_id.eq.${userId}`];
  if (profileId) {
    orFilters.push(`target_profile_id.eq.${profileId}`);
  }
  const { data: auditData } = await supabase
    .from("moderation_actions")
    .select("id, created_at, action_type, actor_user_id, note")
    .or(orFilters.join(","))
    .order("created_at", { ascending: false })
    .limit(25);

  let countryName: string | null = null;
  if (profile?.country_id) {
    const { data: country } = await supabase
      .from("countries")
      .select("name")
      .eq("id", profile.country_id)
      .maybeSingle();
    countryName = (country as { name: string } | null)?.name || null;
  }

  type ProjectDetailRow = {
    id: string;
    title: string;
    slug: string | null;
    moderation_status: string | null;
    created_at: string;
  };
  type ArticleDetailRow = {
    id: string;
    title: string;
    slug: string;
    moderation_status: string | null;
    created_at: string;
  };
  type AuditDetailRow = {
    id: string;
    created_at: string;
    action_type: string;
    actor_user_id: string;
    note: string | null;
  };

  const projects = (projectsResponse.data as ProjectDetailRow[] | null) || [];
  const articles = (articlesResponse.data as ArticleDetailRow[] | null) || [];
  const auditRaw = (auditData as AuditDetailRow[] | null) || [];

  const actorIds = Array.from(new Set(auditRaw.map((row) => row.actor_user_id)));
  const actorProfiles = await getProfilesByUserIds(actorIds);

  return {
    userId,
    profileId: profile?.id || null,
    email,
    displayName: profile?.name || null,
    username: profile?.username || null,
    avatarUrl: profile?.avatar_url || null,
    bio: profile?.bio || null,
    headline: profile?.headline || null,
    countryId: profile?.country_id || null,
    countryName,
    moderationStatus: normalizeStatus(profile?.moderation_status),
    isAdmin: Boolean(adminResponse.data),
    createdAt: authCreatedAt || profile?.created_at || null,
    lastSignInAt,
    counts: {
      projects: projects.length,
      articles: articles.length,
      comments:
        (articleCommentsResponse.count || 0) +
        (projectCommentsResponse.count || 0),
    },
    projects: projects.map((row) => ({
      id: row.id,
      title: row.title,
      path: buildProjectPath(row.id, row.slug),
      moderationStatus: normalizeStatus(row.moderation_status),
      createdAt: row.created_at,
    })),
    articles: articles.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      moderationStatus: normalizeStatus(row.moderation_status),
      createdAt: row.created_at,
    })),
    auditActions: auditRaw.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      actionType: row.action_type,
      actorLabel: authorLabel(actorProfiles.get(row.actor_user_id)),
      note: row.note,
    })),
  };
}
