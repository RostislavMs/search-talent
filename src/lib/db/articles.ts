import { unstable_noStore as noStore } from "next/cache";
import {
  normalizeArticleSort,
  normalizeArticleStatus,
  slugifyArticleTitle,
  type ArticleAuthor,
  type ArticleCategory,
  type ArticleComment,
  type ArticleDashboardItem,
  type ArticleDetail,
  type ArticleFeedItem,
} from "@/lib/articles";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { getReactionsForTargets } from "@/lib/db/reactions";
import { loadAcceptedCoAuthorsMap } from "@/lib/db/co-authors";

// Shape of a single language version, both as stored in the `translations`
// jsonb column and as accepted from the API payload.
export type ArticleLocalizedFields = {
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  cover_image_storage_path: string | null;
  hero_video_url: string | null;
  hero_video_storage_path: string | null;
};

export type ArticleTranslationInput = {
  title: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  cover_image_storage_path?: string | null;
  hero_video_url?: string | null;
  hero_video_storage_path?: string | null;
};

type ArticleRow = {
  id: string;
  author_user_id: string | null;
  category_id: number | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  cover_image_storage_path: string | null;
  hero_video_url: string | null;
  hero_video_storage_path: string | null;
  status: string | null;
  moderation_status: string | null;
  moderation_note: string | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  pinned_until: string | null;
  published_at: string | null;
  created_at: string | null;
  content_locale: string | null;
  translations: Record<string, Partial<ArticleLocalizedFields>> | null;
};

type ArticleCategoryRow = {
  id: number;
  slug: string;
  name: string;
  name_uk: string | null;
  description: string | null;
  admin_only: boolean | null;
};

type ArticleCommentRow = {
  id: string;
  article_id: string;
  author_user_id: string | null;
  parent_id: string | null;
  body: string | null;
  created_at: string | null;
};

type ProfileSummaryRow = {
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
};

function mapCategory(row: ArticleCategoryRow | null | undefined): ArticleCategory | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameUk: row.name_uk || null,
    description: row.description || null,
    adminOnly: Boolean(row.admin_only),
  };
}

function mapAuthor(row: ProfileSummaryRow | null | undefined): ArticleAuthor | null {
  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    username: row.username || null,
    name: row.name || null,
    avatarUrl: row.avatar_url || null,
  };
}

function buildCommentTree(
  rows: ArticleCommentRow[],
  authorMap: Map<string, ArticleAuthor>,
): ArticleComment[] {
  const commentMap = new Map<string, ArticleComment>();
  const roots: ArticleComment[] = [];

  for (const row of rows) {
    const author = row.author_user_id
      ? authorMap.get(row.author_user_id) || null
      : null;
    commentMap.set(row.id, {
      id: row.id,
      parentId: row.parent_id,
      authorUserId: row.author_user_id,
      body: row.body || "",
      createdAt: row.created_at,
      author,
      authorDeleted: row.author_user_id === null,
      replies: [],
    });
  }

  for (const row of rows) {
    const comment = commentMap.get(row.id);

    if (!comment) {
      continue;
    }

    if (row.parent_id && commentMap.has(row.parent_id)) {
      commentMap.get(row.parent_id)?.replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

async function getCategoriesMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryIds: number[],
) {
  if (categoryIds.length === 0) {
    return new Map<number, ArticleCategory>();
  }

  const { data } = await supabase
    .from("article_categories")
    .select("id, slug, name, name_uk, description, admin_only")
    .in("id", categoryIds);

  return new Map(
    ((data || []) as ArticleCategoryRow[]).map((item) => [item.id, mapCategory(item)!]),
  );
}

async function getAuthorsMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorIds: string[],
) {
  if (authorIds.length === 0) {
    return new Map<string, ArticleAuthor>();
  }

  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url")
    .in("user_id", authorIds);

  return new Map(
    ((data || []) as ProfileSummaryRow[]).map((item) => [item.user_id, mapAuthor(item)!]),
  );
}

// Pick the language version a reader should see. Defaults to the primary
// (top-level) version; if the reader's locale differs and a non-empty
// translation exists, that one is returned. Otherwise we fall back to primary.
// Find the first uploaded media (url + its storage path, kept as a pair) on the
// article, scanning the primary (top-level) fields first, then any translation.
// Lets a single uploaded cover/hero be reused across language versions that
// didn't get their own.
function firstArticleMedia(
  row: ArticleRow,
  urlKey: "cover_image_url" | "hero_video_url",
  pathKey: "cover_image_storage_path" | "hero_video_storage_path",
): { url: string | null; path: string | null } {
  if (row[urlKey]) {
    return { url: row[urlKey], path: row[pathKey] };
  }

  for (const version of Object.values(row.translations ?? {})) {
    if (version[urlKey]) {
      return { url: version[urlKey] ?? null, path: version[pathKey] ?? null };
    }
  }

  return { url: null, path: null };
}

function pickLocalizedVersion(
  row: ArticleRow,
  locale?: string | null,
): ArticleLocalizedFields {
  const primary: ArticleLocalizedFields = {
    title: row.title,
    excerpt: row.excerpt,
    content: row.content ?? "",
    cover_image_url: row.cover_image_url,
    cover_image_storage_path: row.cover_image_storage_path,
    hero_video_url: row.hero_video_url,
    hero_video_storage_path: row.hero_video_storage_path,
  };

  const primaryLocale = row.content_locale || "uk";

  let chosen = primary;

  if (locale && locale !== primaryLocale) {
    const alt = row.translations?.[locale];

    if (alt && (alt.title?.trim() || alt.content?.trim())) {
      chosen = {
        title: alt.title?.trim() ? alt.title : primary.title,
        excerpt: alt.excerpt ?? null,
        content: alt.content?.trim() ? alt.content : primary.content,
        cover_image_url: alt.cover_image_url ?? null,
        cover_image_storage_path: alt.cover_image_storage_path ?? null,
        hero_video_url: alt.hero_video_url ?? null,
        hero_video_storage_path: alt.hero_video_storage_path ?? null,
      };
    }
  }

  // Reuse a single uploaded cover/hero across both language versions: when the
  // chosen version has none of its own, borrow whatever the article has
  // elsewhere (the other language's upload). Works in both directions —
  // upload on either tab shows on both.
  if (!chosen.cover_image_url) {
    const cover = firstArticleMedia(
      row,
      "cover_image_url",
      "cover_image_storage_path",
    );
    chosen = {
      ...chosen,
      cover_image_url: cover.url,
      cover_image_storage_path: cover.path,
    };
  }

  if (!chosen.hero_video_url) {
    const hero = firstArticleMedia(
      row,
      "hero_video_url",
      "hero_video_storage_path",
    );
    chosen = {
      ...chosen,
      hero_video_url: hero.url,
      hero_video_storage_path: hero.path,
    };
  }

  return chosen;
}

function toFeedItem(
  row: ArticleRow,
  categoryMap: Map<number, ArticleCategory>,
  authorMap: Map<string, ArticleAuthor>,
  locale?: string | null,
): ArticleFeedItem {
  const localized = pickLocalizedVersion(row, locale);

  return {
    id: row.id,
    slug: row.slug,
    title: localized.title,
    excerpt: localized.excerpt,
    content: localized.content,
    coverImageUrl: localized.cover_image_url,
    heroVideoUrl: localized.hero_video_url,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    viewsCount: row.views_count ?? 0,
    likesCount: row.likes_count ?? 0,
    commentsCount: row.comments_count ?? 0,
    category: row.category_id ? categoryMap.get(row.category_id) || null : null,
    author: row.author_user_id ? authorMap.get(row.author_user_id) || null : null,
    authorDeleted: row.author_user_id === null,
    pinnedUntil: row.pinned_until,
  };
}

export async function getArticleCategories() {
  noStore();
  const supabase = await createClient();
  const { data } = await supabase
    .from("article_categories")
    .select("id, slug, name, name_uk, description, admin_only")
    .order("name", { ascending: true });

  return ((data || []) as ArticleCategoryRow[]).map((item) => mapCategory(item)!);
}

export async function getArticleFeed(params?: {
  categorySlug?: string | null;
  authorQuery?: string | null;
  sort?: string | null;
  locale?: string | null;
}) {
  noStore();
  const viewer = await getCurrentViewerRole();
  const supabase = viewer.supabase;
  const sort = normalizeArticleSort(params?.sort);

  let query = supabase
    .from("articles")
    .select(
      "id, author_user_id, category_id, title, slug, excerpt, content, cover_image_url, cover_image_storage_path, hero_video_url, hero_video_storage_path, status, moderation_status, moderation_note, views_count, likes_count, comments_count, pinned_until, published_at, created_at, content_locale, translations",
    )
    .eq("status", "published")
    .limit(60);

  if (params?.categorySlug) {
    const { data: category } = await supabase
      .from("article_categories")
      .select("id")
      .eq("slug", params.categorySlug)
      .maybeSingle();

    if (!category) {
      return {
        items: [] as ArticleFeedItem[],
        categories: await getArticleCategories(),
      };
    }

    query = query.eq("category_id", category.id);
  }

  const { data } = await query.order(
    sort === "popular" ? "views_count" : "published_at",
    { ascending: false },
  );

  let rows = ((data || []) as ArticleRow[]).filter((item) => {
    const isOwner = viewer.user?.id === item.author_user_id;
    return isPublicModerationStatus(item.moderation_status) || viewer.isAdmin || isOwner;
  });

  if (params?.authorQuery?.trim()) {
    const authorQuery = params.authorQuery.trim().toLowerCase();
    const authorsMap = await getAuthorsMap(
      supabase,
      Array.from(
        new Set(
          rows
            .map((item) => item.author_user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    );

    rows = rows.filter((item) => {
      if (!item.author_user_id) return false;
      const author = authorsMap.get(item.author_user_id);
      const candidate = `${author?.name || ""} ${author?.username || ""}`.toLowerCase();
      return candidate.includes(authorQuery);
    });
  }

  const [categoryMap, authorMap, categories] = await Promise.all([
    getCategoriesMap(
      supabase,
      Array.from(
        new Set(
          rows
            .map((item) => item.category_id)
            .filter((item): item is number => typeof item === "number"),
        ),
      ),
    ),
    getAuthorsMap(
      supabase,
      Array.from(
        new Set(
          rows
            .map((item) => item.author_user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ),
    getArticleCategories(),
  ]);

  const now = Date.now();
  const items = rows
    .map((item) => toFeedItem(item, categoryMap, authorMap, params?.locale))
    .sort((left, right) => {
      // Pinned articles always come first
      const leftPinned = left.pinnedUntil && new Date(left.pinnedUntil).getTime() > now ? 1 : 0;
      const rightPinned = right.pinnedUntil && new Date(right.pinnedUntil).getTime() > now ? 1 : 0;
      if (leftPinned !== rightPinned) return rightPinned - leftPinned;

      if (sort === "popular") {
        return right.viewsCount - left.viewsCount || right.likesCount - left.likesCount;
      }

      if (sort === "discussed") {
        return right.commentsCount - left.commentsCount || right.likesCount - left.likesCount;
      }

      return (
        new Date(right.publishedAt || right.createdAt || 0).getTime() -
        new Date(left.publishedAt || left.createdAt || 0).getTime()
      );
    });

  const coAuthorsMap = await loadAcceptedCoAuthorsMap(
    supabase,
    "article",
    items.map((item) => item.id),
  );
  for (const item of items) {
    item.coAuthors = coAuthorsMap.get(item.id) ?? [];
  }

  return {
    items,
    categories,
    viewerUserId: viewer.user?.id || null,
  };
}

export async function getArticleDetail(slug: string, locale?: string | null) {
  noStore();
  const viewer = await getCurrentViewerRole();
  const supabase = viewer.supabase;

  const { data: row } = await supabase
    .from("articles")
    .select(
      "id, author_user_id, category_id, title, slug, excerpt, content, cover_image_url, cover_image_storage_path, hero_video_url, hero_video_storage_path, status, moderation_status, moderation_note, views_count, likes_count, comments_count, pinned_until, published_at, created_at, content_locale, translations",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!row) {
    return null;
  }

  const article = row as ArticleRow;
  const status = normalizeArticleStatus(article.status);
  const isOwner = viewer.user?.id === article.author_user_id;
  const canSeeByStatus = status === "published" || isOwner || viewer.isAdmin;
  const canSeeByModeration =
    isPublicModerationStatus(article.moderation_status) || isOwner || viewer.isAdmin;

  if (!canSeeByStatus || !canSeeByModeration) {
    return null;
  }

  const [categoryMap, authorMap, commentsResponse, currentLikeResponse] =
    await Promise.all([
      getCategoriesMap(
        supabase,
        article.category_id ? [article.category_id] : [],
      ),
      getAuthorsMap(
        supabase,
        article.author_user_id ? [article.author_user_id] : [],
      ),
      supabase
        .from("article_comments")
        .select("id, article_id, author_user_id, parent_id, body, created_at")
        .eq("article_id", article.id)
        .order("created_at", { ascending: true }),
      viewer.user
        ? supabase
            .from("article_likes")
            .select("article_id")
            .eq("article_id", article.id)
            .eq("user_id", viewer.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const commentRows = (commentsResponse.data || []) as ArticleCommentRow[];
  const commentAuthorMap = await getAuthorsMap(
    supabase,
    Array.from(
      new Set(
        commentRows
          .map((item) => item.author_user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  const feedItem = toFeedItem(article, categoryMap, authorMap, locale);
  const localized = pickLocalizedVersion(article, locale);

  const commentTree = buildCommentTree(commentRows, commentAuthorMap);

  const commentIds = commentRows.map((row) => row.id);
  const [articleReactionsMap, commentReactionsMap] = await Promise.all([
    getReactionsForTargets(supabase, {
      targetType: "article",
      targetIds: [article.id],
      viewerUserId: viewer.user?.id ?? null,
    }),
    getReactionsForTargets(supabase, {
      targetType: "article_comment",
      targetIds: commentIds,
      viewerUserId: viewer.user?.id ?? null,
    }),
  ]);

  const annotateReactions = (comments: ArticleComment[]) => {
    for (const comment of comments) {
      comment.reactions = commentReactionsMap[comment.id] || [];
      if (comment.replies.length) annotateReactions(comment.replies);
    }
  };
  annotateReactions(commentTree);

  const coAuthorsMap = await loadAcceptedCoAuthorsMap(supabase, "article", [
    article.id,
  ]);

  const detail: ArticleDetail = {
    ...feedItem,
    coAuthors: coAuthorsMap.get(article.id) ?? [],
    status,
    moderationStatus: article.moderation_status,
    moderationNote: article.moderation_note,
    content: localized.content || "",
    coverImageStoragePath: localized.cover_image_storage_path,
    heroVideoStoragePath: localized.hero_video_storage_path,
    currentUserLiked: Boolean(currentLikeResponse.data),
    reactions: articleReactionsMap[article.id] || [],
    comments: commentTree,
  };

  return {
    article: detail,
    viewerUserId: viewer.user?.id || null,
    isOwner,
    isAdmin: viewer.isAdmin,
  };
}

export async function getDashboardArticles(locale?: string | null) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("articles")
    .select(
      "id, category_id, title, slug, status, moderation_status, moderation_note, views_count, likes_count, comments_count, published_at, created_at, content_locale, translations",
    )
    .eq("author_user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data || []) as Array<{
    id: string;
    category_id: number | null;
    title: string;
    slug: string;
    status: string | null;
    moderation_status: string | null;
    moderation_note: string | null;
    views_count: number | null;
    likes_count: number | null;
    comments_count: number | null;
    published_at: string | null;
    created_at: string | null;
    content_locale: string | null;
    translations: Record<string, Partial<ArticleLocalizedFields>> | null;
  }>;

  const [categoryMap, categories] = await Promise.all([
    getCategoriesMap(
      supabase,
      Array.from(
        new Set(
          rows
            .map((item) => item.category_id)
            .filter((item): item is number => typeof item === "number"),
        ),
      ),
    ),
    getArticleCategories(),
  ]);

  return {
    userId: user.id,
    items: rows.map((item): ArticleDashboardItem => {
      const primaryLocale = item.content_locale || "uk";
      const localizedTitle =
        locale && locale !== primaryLocale
          ? item.translations?.[locale]?.title?.trim() || item.title
          : item.title;

      return {
        id: item.id,
        slug: item.slug,
        title: localizedTitle,
        status: normalizeArticleStatus(item.status),
        createdAt: item.created_at,
        publishedAt: item.published_at,
        viewsCount: item.views_count ?? 0,
        likesCount: item.likes_count ?? 0,
        commentsCount: item.comments_count ?? 0,
        category: item.category_id ? categoryMap.get(item.category_id) || null : null,
        moderationStatus: item.moderation_status,
        moderationNote: item.moderation_note,
      };
    }),
    categories,
  };
}

export async function getArticleModerationQueue(locale?: string | null) {
  noStore();
  const viewer = await getCurrentViewerRole();

  if (!viewer.user || !viewer.isAdmin) {
    return null;
  }

  const supabase = viewer.supabase;
  const { data } = await supabase
    .from("articles")
    .select(
      "id, author_user_id, category_id, title, slug, excerpt, content, cover_image_url, cover_image_storage_path, hero_video_url, hero_video_storage_path, status, moderation_status, moderation_note, views_count, likes_count, comments_count, pinned_until, published_at, created_at, content_locale, translations",
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (data || []) as ArticleRow[];
  const [categoryMap, authorMap] = await Promise.all([
    getCategoriesMap(
      supabase,
      Array.from(
        new Set(
          rows
            .map((item) => item.category_id)
            .filter((item): item is number => typeof item === "number"),
        ),
      ),
    ),
    getAuthorsMap(
      supabase,
      Array.from(
        new Set(
          rows
            .map((item) => item.author_user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ),
  ]);

  const moderationRank = {
    under_review: 3,
    restricted: 2,
    removed: 1,
    approved: 0,
  } as const;

  return rows
    .map((item) => ({
      ...toFeedItem(item, categoryMap, authorMap, locale),
      status: normalizeArticleStatus(item.status),
      moderationStatus: item.moderation_status,
      moderationNote: item.moderation_note,
    }))
    .sort(
      (left, right) =>
        (moderationRank[right.moderationStatus as keyof typeof moderationRank] || 0) -
          (moderationRank[left.moderationStatus as keyof typeof moderationRank] || 0) ||
        new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
    );
}

export async function ensureUniqueArticleSlug(
  title: string,
  excludeId?: string,
) {
  const supabase = await createClient();
  const baseSlug = slugifyArticleTitle(title);
  const { data } = await supabase
    .from("articles")
    .select("id, slug")
    .ilike("slug", `${baseSlug}%`);

  const existing = new Set(
    ((data || []) as Array<{ id: string; slug: string | null }>)
      .filter((item) => item.id !== excludeId)
      .map((item) => item.slug)
      .filter((item): item is string => Boolean(item)),
  );

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existing.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}
