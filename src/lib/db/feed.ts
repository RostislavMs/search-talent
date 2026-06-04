import "server-only";

import { isPublicModerationStatus } from "@/lib/moderation";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";

/** A published article shaped for the RSS feed. */
export type FeedArticle = {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  authorName: string | null;
  authorUsername: string | null;
};

export type FeedAuthor = {
  userId: string;
  name: string | null;
  username: string;
};

/** Default number of articles included in a feed. */
export const FEED_ARTICLE_LIMIT = 30;

type FeedArticleRow = {
  slug: string;
  title: string;
  excerpt: string | null;
  author_user_id: string | null;
  published_at: string | null;
  created_at: string | null;
};

/**
 * Public, approved, published articles for an RSS feed — newest first.
 *
 * Reads through the anonymous read-only client (no cookies) so the route can
 * be cached and shared across visitors. Returns `[]` when the read-only client
 * is unavailable rather than throwing, keeping the feed route resilient.
 */
export async function getArticlesForFeed(options?: {
  authorUserId?: string;
  limit?: number;
}): Promise<FeedArticle[]> {
  const supabase = createPublicReadOnlyClient();
  if (!supabase) {
    return [];
  }

  const limit = options?.limit ?? FEED_ARTICLE_LIMIT;

  let query = supabase
    .from("articles")
    .select("slug, title, excerpt, author_user_id, published_at, created_at")
    .eq("status", "published")
    .eq("moderation_status", "approved")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (options?.authorUserId) {
    query = query.eq("author_user_id", options.authorUserId);
  }

  const { data } = await query;
  const rows = (data || []) as FeedArticleRow[];

  const authorIds = Array.from(
    new Set(
      rows
        .map((row) => row.author_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const authorById = new Map<string, { name: string | null; username: string | null }>();
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("user_id, name, username")
      .in("user_id", authorIds);

    for (const author of (authors || []) as Array<{
      user_id: string;
      name: string | null;
      username: string | null;
    }>) {
      authorById.set(author.user_id, {
        name: author.name,
        username: author.username,
      });
    }
  }

  return rows.map((row) => {
    const author = row.author_user_id
      ? authorById.get(row.author_user_id)
      : undefined;
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      authorName: author?.name ?? null,
      authorUsername: author?.username ?? null,
    };
  });
}

/**
 * Resolve a username to a public author for a per-author feed. Returns `null`
 * when the profile is missing, has no username, or is not publicly visible.
 */
export async function getFeedAuthor(username: string): Promise<FeedAuthor | null> {
  const supabase = createPublicReadOnlyClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("user_id, name, username, moderation_status")
    .eq("username", username)
    .maybeSingle();

  if (!data || !data.username || !isPublicModerationStatus(data.moderation_status)) {
    return null;
  }

  return {
    userId: data.user_id,
    name: data.name,
    username: data.username,
  };
}
