import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DISCUSSIONS_CATEGORY_SLUG } from "@/lib/articles";
import {
  buildDiscussionPath,
  DISCUSSION_COMMENT_THRESHOLD,
} from "@/lib/discussions";
import { isPublicModerationStatus } from "@/lib/moderation";
import { getCurrentViewerRole } from "@/lib/moderation-server";

/**
 * What a row in the /discussions listing is. `topic` rows are standalone
 * articles in the Discussions category; the other three are auto-promoted
 * comment threads that live on their parent content.
 */
export type DiscussionListKind = "topic" | "project" | "article" | "poll";

export type DiscussionAuthor = {
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type DiscussionListItem = {
  key: string;
  kind: DiscussionListKind;
  title: string;
  /** Locale-less path; LocalizedLink adds the prefix. */
  href: string;
  excerpt: string | null;
  commentsCount: number;
  createdAt: string | null;
  author: DiscussionAuthor | null;
  /** Viewer's own unpublished topic — shown only to them, always on top. */
  isDraft?: boolean;
};

export type DiscussionsListing = {
  items: DiscussionListItem[];
  /** Totals over the whole listing, not the filtered view. */
  stats: {
    topics: number;
    threads: number;
    comments: number;
  };
};

type ContentRow = {
  id: string;
  slug: string | null;
  title: string | null;
  excerpt?: string | null;
  comments_count: number | null;
  moderation_status: string | null;
  published_at?: string | null;
  created_at: string | null;
  /** `author_user_id` everywhere except projects, which use `owner_id`. */
  author_user_id?: string | null;
  owner_id?: string | null;
};

const LISTING_LIMIT = 60;

/** A listing row before its author profile has been resolved. */
type AuthoredItem = { item: DiscussionListItem; authorId: string | null };

function rowAuthorId(row: ContentRow): string | null {
  return row.author_user_id ?? row.owner_id ?? null;
}

function toItem(
  row: ContentRow,
  kind: DiscussionListKind,
  href: string,
): DiscussionListItem {
  return {
    key: `${kind}:${row.id}`,
    kind,
    title: row.title || "",
    href,
    excerpt: row.excerpt ?? null,
    commentsCount: row.comments_count ?? 0,
    createdAt: row.published_at ?? row.created_at ?? null,
    author: null,
  };
}

/**
 * Fills in author profiles for a whole listing in one query. Kept out of the
 * per-source loaders so four sources cost one profile round trip, not four.
 */
async function attachAuthors(
  supabase: SupabaseClient,
  entries: Array<{ item: DiscussionListItem; authorId: string | null }>,
): Promise<DiscussionListItem[]> {
  const authorIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.authorId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  if (authorIds.length === 0) {
    return entries.map((entry) => entry.item);
  }

  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, name, avatar_url")
    .in("user_id", authorIds);

  const byUserId = new Map(
    ((data || []) as Array<{
      user_id: string;
      username: string | null;
      name: string | null;
      avatar_url: string | null;
    }>).map((row) => [
      row.user_id,
      {
        username: row.username,
        name: row.name,
        avatarUrl: row.avatar_url,
      } satisfies DiscussionAuthor,
    ]),
  );

  return entries.map((entry) => ({
    ...entry.item,
    author: entry.authorId ? byUserId.get(entry.authorId) ?? null : null,
  }));
}

function isVisible(row: ContentRow): boolean {
  return Boolean(row.slug) && isPublicModerationStatus(row.moderation_status);
}

async function getDiscussionsCategoryId(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data } = await supabase
    .from("article_categories")
    .select("id")
    .eq("slug", DISCUSSIONS_CATEGORY_SLUG)
    .maybeSingle();

  return (data as { id: number } | null)?.id ?? null;
}

/** Standalone topics — articles filed under the Discussions category. */
async function getStandaloneTopics(
  supabase: SupabaseClient,
  categoryId: number | null,
): Promise<AuthoredItem[]> {
  if (categoryId === null) {
    return [];
  }

  const { data } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, comments_count, moderation_status, published_at, created_at, author_user_id",
    )
    .eq("status", "published")
    .eq("category_id", categoryId)
    .order("published_at", { ascending: false })
    .limit(LISTING_LIMIT);

  return ((data || []) as ContentRow[])
    .filter(isVisible)
    .map((row) => ({
      item: toItem(row, "topic", `/discussions/${row.slug}`),
      authorId: rowAuthorId(row),
    }));
}

/**
 * The viewer's own unpublished topics. Drafts are hidden from every article
 * surface and have no public listing, so without this a saved draft would be
 * reachable only by remembering its URL.
 */
async function getOwnDraftTopics(
  supabase: SupabaseClient,
  categoryId: number | null,
  viewerUserId: string | null,
): Promise<AuthoredItem[]> {
  if (categoryId === null || !viewerUserId) {
    return [];
  }

  const { data } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, comments_count, moderation_status, published_at, created_at, author_user_id",
    )
    .eq("status", "draft")
    .eq("category_id", categoryId)
    .eq("author_user_id", viewerUserId)
    .order("created_at", { ascending: false })
    .limit(LISTING_LIMIT);

  return ((data || []) as ContentRow[])
    .filter((row) => Boolean(row.slug))
    .map((row) => ({
      item: {
        ...toItem(row, "topic", `/discussions/${row.slug}`),
        isDraft: true,
      },
      authorId: rowAuthorId(row),
    }));
}

/**
 * Promoted threads hanging off projects. Reads the denormalized
 * `projects.comments_count` added in database/2026-08-11-discussions.sql — if
 * that migration has not been applied yet the column is missing, so this
 * degrades to "no project threads" instead of breaking the whole page.
 */
async function getPromotedProjectThreads(
  supabase: SupabaseClient,
): Promise<AuthoredItem[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, slug, title, description, comments_count, moderation_status, created_at, owner_id",
    )
    .eq("status", "published")
    .gte("comments_count", DISCUSSION_COMMENT_THRESHOLD)
    .order("created_at", { ascending: false })
    .limit(LISTING_LIMIT);

  if (error) {
    console.warn(
      "[discussions] project threads unavailable — is 2026-08-11-discussions.sql applied?",
      error.message,
    );
    return [];
  }

  return ((data || []) as Array<ContentRow & { description: string | null }>)
    .filter(isVisible)
    .map((row) => ({
      item: toItem(
        { ...row, excerpt: row.description },
        "project",
        buildDiscussionPath("project", row.slug as string),
      ),
      authorId: rowAuthorId(row),
    }));
}

/**
 * Promoted threads hanging off articles. Topics are excluded — their own row
 * already represents them, and listing both would double-count one thread.
 */
async function getPromotedArticleThreads(
  supabase: SupabaseClient,
  discussionsCategoryId: number | null,
): Promise<AuthoredItem[]> {
  let query = supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, comments_count, moderation_status, published_at, created_at, author_user_id",
    )
    .eq("status", "published")
    .gte("comments_count", DISCUSSION_COMMENT_THRESHOLD);

  if (discussionsCategoryId !== null) {
    query = query.or(
      `category_id.is.null,category_id.neq.${discussionsCategoryId}`,
    );
  }

  const { data } = await query
    .order("published_at", { ascending: false })
    .limit(LISTING_LIMIT);

  return ((data || []) as ContentRow[])
    .filter(isVisible)
    .map((row) => ({
      item: toItem(
        row,
        "article",
        buildDiscussionPath("article", row.slug as string),
      ),
      authorId: rowAuthorId(row),
    }));
}

/** Promoted threads hanging off polls. */
async function getPromotedPollThreads(
  supabase: SupabaseClient,
): Promise<AuthoredItem[]> {
  const { data } = await supabase
    .from("polls")
    .select(
      "id, slug, title, excerpt, comments_count, moderation_status, published_at, created_at, author_user_id",
    )
    .eq("status", "published")
    .gte("comments_count", DISCUSSION_COMMENT_THRESHOLD)
    .order("published_at", { ascending: false })
    .limit(LISTING_LIMIT);

  return ((data || []) as ContentRow[])
    .filter(isVisible)
    .map((row) => ({
      item: toItem(row, "poll", buildDiscussionPath("poll", row.slug as string)),
      authorId: rowAuthorId(row),
    }));
}

/**
 * The /discussions listing: standalone topics plus every thread busy enough to
 * have earned its own page.
 *
 * Sorted newest first, size as the tiebreak. Busiest-first was the obvious
 * choice and is the wrong one: a fresh topic has no replies by definition, so
 * ranking by size buries every new topic under the established threads and it
 * never gets the first reply that would lift it. Recency is what gives a new
 * topic its chance.
 *
 * True last-activity ordering would need a max(created_at) per thread across
 * three comment tables — no index, no denormalized column — so it is
 * deliberately not attempted here.
 */
export async function getDiscussionsListing(params?: {
  /** Narrows the rows; the stats strip still reports the unfiltered totals. */
  kind?: DiscussionListKind | null;
  /** Restricts to one author — used by "my discussions". */
  authorUserId?: string | null;
}): Promise<DiscussionsListing> {
  noStore();
  const viewer = await getCurrentViewerRole();
  const supabase = viewer.supabase;
  const categoryId = await getDiscussionsCategoryId(supabase);

  const [drafts, topics, projects, articles, polls] = await Promise.all([
    getOwnDraftTopics(supabase, categoryId, viewer.user?.id ?? null),
    getStandaloneTopics(supabase, categoryId),
    getPromotedProjectThreads(supabase),
    getPromotedArticleThreads(supabase, categoryId),
    getPromotedPollThreads(supabase),
  ]);

  const publishedEntries = [...topics, ...projects, ...articles, ...polls].sort(
    (a, b) => {
      const byRecency = (b.item.createdAt || "").localeCompare(
        a.item.createdAt || "",
      );

      return byRecency !== 0
        ? byRecency
        : b.item.commentsCount - a.item.commentsCount;
    },
  );

  // Drafts sit above everything: they are the viewer's unfinished business, and
  // burying them in a recency sort next to public threads hides the one thing
  // only they can act on.
  const entries = [...drafts, ...publishedEntries];

  const stats = {
    topics: entries.filter((entry) => entry.item.kind === "topic").length,
    threads: entries.filter((entry) => entry.item.kind !== "topic").length,
    comments: entries.reduce(
      (sum, entry) => sum + entry.item.commentsCount,
      0,
    ),
  };

  const filtered = entries.filter((entry) => {
    if (params?.kind && entry.item.kind !== params.kind) {
      return false;
    }

    if (params?.authorUserId && entry.authorId !== params.authorUserId) {
      return false;
    }

    return true;
  });

  const items = await attachAuthors(
    supabase,
    filtered.slice(0, LISTING_LIMIT),
  );

  return { items, stats };
}
