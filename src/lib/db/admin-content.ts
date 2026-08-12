import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildProjectPath } from "@/lib/projects";
import {
  excludeSectionCategories,
  getDiscussionsCategoryIds,
} from "@/lib/db/article-sections";
import type { ModerationStatus } from "@/lib/moderation";

const PER_PAGE = 25;

type ContentFilterParams = {
  search?: string;
  status?: "all" | ModerationStatus;
  page?: number;
  perPage?: number;
};

/**
 * Which slice of the `articles` table a list covers. Topics are articles under
 * the hood but have their own admin section, so the two lists are complements —
 * every row appears in exactly one of them.
 */
export type AdminArticleScope = "articles" | "discussions";

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
  /** Applied to the count queries so the chips match the rows on screen. */
  narrow?: <T>(query: T) => T,
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
      const base = supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", status);
      const { count } = await (narrow ? narrow(base) : base);
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
  params: ContentFilterParams & { scope?: AdminArticleScope } = {},
): Promise<AdminArticlesList> {
  const {
    search = "",
    status = "all",
    page = 1,
    perPage = PER_PAGE,
    scope = "articles",
  } = params;

  const supabase = await createClient();
  const offset = (Math.max(1, page) - 1) * perPage;
  const discussionCategoryIds = await getDiscussionsCategoryIds(supabase);
  const discussionCategoryId = discussionCategoryIds[0] ?? null;

  // The Discussions section owns topics; the Articles section owns everything
  // else. Applied to both the rows and the status counts so they agree.
  const narrow = <T,>(query: T): T => {
    if (discussionCategoryId === null) {
      // No category row yet (migration unapplied): there are no topics, so the
      // articles list is already correct and the discussions list is empty.
      return scope === "discussions"
        ? (query as { eq: (c: string, v: number) => T }).eq("category_id", -1)
        : query;
    }

    return scope === "discussions"
      ? (query as { eq: (c: string, v: number) => T }).eq(
          "category_id",
          discussionCategoryId,
        )
      : excludeSectionCategories(query, discussionCategoryIds);
  };

  let query = narrow(
    supabase
      .from("articles")
      .select(
        "id, title, slug, created_at, moderation_status, author_user_id, likes_count, comments_count",
        { count: "exact" },
      ),
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
  const statusCounts = await getStatusCounts("articles", narrow);

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

export type AdminCommentKind = "article" | "project" | "poll";

export type AdminCommentRow = {
  id: string;
  kind: AdminCommentKind;
  body: string;
  mediaUrl: string | null;
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

type AdminCommentSource = {
  commentTable: string;
  /** Column on the comment row pointing at the content it belongs to. */
  contentFk: string;
  contentTable: string;
  buildHref: (row: { id: string; slug: string | null }) => string | null;
};

/**
 * One entry per commentable content type. Written as a table rather than a
 * hand-merged pair of queries because that pair silently left poll comments
 * unmoderatable: they existed, but no admin surface listed them.
 */
const ADMIN_COMMENT_SOURCES: Record<AdminCommentKind, AdminCommentSource> = {
  article: {
    commentTable: "article_comments",
    contentFk: "article_id",
    contentTable: "articles",
    buildHref: (row) => (row.slug ? `/articles/${row.slug}` : null),
  },
  project: {
    commentTable: "project_comments",
    contentFk: "project_id",
    contentTable: "projects",
    buildHref: (row) => buildProjectPath(row.id, row.slug),
  },
  poll: {
    commentTable: "poll_comments",
    contentFk: "poll_id",
    contentTable: "polls",
    buildHref: (row) => (row.slug ? `/polls/${row.slug}` : null),
  },
};

export const ADMIN_COMMENT_KINDS = Object.keys(
  ADMIN_COMMENT_SOURCES,
) as AdminCommentKind[];

/** Newest comments scanned per source. The cap is per source, as it always was. */
const ADMIN_COMMENT_SCAN_LIMIT = 200;

type RawCommentRow = {
  id: string;
  author_user_id: string;
  body: string;
  media_url: string | null;
  created_at: string;
} & Record<string, unknown>;

export async function getAdminCommentsList(
  params: {
    kind?: "all" | AdminCommentKind;
    page?: number;
    perPage?: number;
  } = {},
): Promise<AdminCommentsList> {
  const { kind = "all", page = 1, perPage = PER_PAGE } = params;
  const supabase = await createClient();

  const activeKinds =
    kind === "all" ? ADMIN_COMMENT_KINDS : ([kind] as AdminCommentKind[]);

  const responses = await Promise.all(
    activeKinds.map(async (activeKind) => {
      const source = ADMIN_COMMENT_SOURCES[activeKind];
      const { data, count } = await supabase
        .from(source.commentTable)
        .select(
          `id, ${source.contentFk}, author_user_id, body, media_url, created_at`,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .limit(ADMIN_COMMENT_SCAN_LIMIT);

      return {
        kind: activeKind,
        // The select list is built from the source table, so PostgREST's
        // literal-string typing cannot infer the row shape here.
        rows: (data || []) as unknown as RawCommentRow[],
        count: count || 0,
      };
    }),
  );

  const authorIds = Array.from(
    new Set(
      responses.flatMap(({ rows }) => rows.map((row) => row.author_user_id)),
    ),
  );

  const [profileMap, targetMaps] = await Promise.all([
    getProfilesByUserIds(authorIds),
    Promise.all(
      responses.map(async ({ kind: activeKind, rows }) => {
        const source = ADMIN_COMMENT_SOURCES[activeKind];
        const contentIds = Array.from(
          new Set(rows.map((row) => String(row[source.contentFk]))),
        );
        const targets = new Map<string, { label: string; href: string | null }>();

        if (contentIds.length === 0) {
          return [activeKind, targets] as const;
        }

        const { data } = await supabase
          .from(source.contentTable)
          .select("id, title, slug")
          .in("id", contentIds);

        for (const row of (data || []) as Array<{
          id: string;
          title: string;
          slug: string | null;
        }>) {
          targets.set(row.id, { label: row.title, href: source.buildHref(row) });
        }

        return [activeKind, targets] as const;
      }),
    ),
  ]);

  const targetsByKind = new Map(targetMaps);

  const combined: AdminCommentRow[] = responses.flatMap(
    ({ kind: activeKind, rows }) => {
      const source = ADMIN_COMMENT_SOURCES[activeKind];
      const targets = targetsByKind.get(activeKind);

      return rows.map<AdminCommentRow>((row) => {
        const target = targets?.get(String(row[source.contentFk]));

        return {
          id: row.id,
          kind: activeKind,
          body: row.body,
          mediaUrl: row.media_url,
          createdAt: row.created_at,
          authorUserId: row.author_user_id,
          authorLabel: authorLabel(profileMap.get(row.author_user_id)),
          authorHref: authorHref(profileMap.get(row.author_user_id)),
          targetLabel: target?.label || "\u2014",
          targetHref: target?.href || null,
        };
      });
    },
  );

  combined.sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const total = responses.reduce((sum, response) => sum + response.count, 0);
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
