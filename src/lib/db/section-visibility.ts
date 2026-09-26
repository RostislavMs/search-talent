import "server-only";

import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DISCUSSIONS_CATEGORY_SLUG,
  NEWS_CATEGORY_SLUG,
} from "@/lib/articles";
import {
  SECTION_VISIBILITY_REVALIDATE_SECONDS,
  SECTION_VISIBILITY_THRESHOLDS,
} from "@/lib/constants/visibility";
import { DISCUSSION_COMMENT_THRESHOLD } from "@/lib/discussions";
import {
  ALL_SECTIONS_VISIBLE,
  resolveSectionVisibility,
  type SectionCounts,
  type SectionVisibility,
} from "@/lib/section-visibility";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";

export const SECTION_VISIBILITY_CACHE_TAG = "section-visibility";

/** Distinct poll authors only need to be counted up to the threshold. */
const POLL_AUTHOR_SAMPLE = 1000;

type CountResult = { count: number | null; error: { message: string } | null };

function countOrThrow({ count, error }: CountResult): number {
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function getCategoryIds(
  supabase: SupabaseClient,
): Promise<{ news: number | null; discussions: number | null }> {
  const { data, error } = await supabase
    .from("article_categories")
    .select("id, slug")
    .in("slug", [NEWS_CATEGORY_SLUG, DISCUSSIONS_CATEGORY_SLUG]);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as Array<{ id: number; slug: string }>;
  return {
    news: rows.find((row) => row.slug === NEWS_CATEGORY_SLUG)?.id ?? null,
    discussions:
      rows.find((row) => row.slug === DISCUSSIONS_CATEGORY_SLUG)?.id ?? null,
  };
}

// Reads with the anonymous client on purpose: the counts should reflect what a
// visitor can actually see, and RLS already hides unpublished or moderated rows.
async function loadSectionCounts(
  supabase: SupabaseClient,
): Promise<SectionCounts> {
  const categories = await getCategoryIds(supabase);
  const newsSince = new Date(
    Date.now() -
      SECTION_VISIBILITY_THRESHOLDS.news.windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const countHead = { count: "exact" as const, head: true };

  const [
    polls,
    topics,
    projectThreads,
    articleThreads,
    pollThreads,
    recentNews,
    publicProfiles,
  ] = await Promise.all([
    supabase
      .from("polls")
      .select("author_user_id", { count: "exact" })
      .eq("status", "published")
      .limit(POLL_AUTHOR_SAMPLE),
    categories.discussions === null
      ? Promise.resolve({ count: 0, error: null })
      : supabase
          .from("articles")
          .select("id", countHead)
          .eq("status", "published")
          .eq("category_id", categories.discussions),
    supabase
      .from("projects")
      .select("id", countHead)
      .eq("status", "published")
      .gte("comments_count", DISCUSSION_COMMENT_THRESHOLD),
    // Topics are articles too; excluding their category keeps one discussion
    // from being counted as both a topic and a thread.
    (() => {
      const query = supabase
        .from("articles")
        .select("id", countHead)
        .eq("status", "published")
        .gte("comments_count", DISCUSSION_COMMENT_THRESHOLD);
      return categories.discussions === null
        ? query
        : query.or(
            `category_id.is.null,category_id.neq.${categories.discussions}`,
          );
    })(),
    supabase
      .from("polls")
      .select("id", countHead)
      .eq("status", "published")
      .gte("comments_count", DISCUSSION_COMMENT_THRESHOLD),
    categories.news === null
      ? Promise.resolve({ count: 0, error: null })
      : supabase
          .from("articles")
          .select("id", countHead)
          .eq("status", "published")
          .eq("category_id", categories.news)
          .gte("published_at", newsSince),
    supabase
      .from("profiles")
      .select("id", countHead)
      .not("username", "is", null),
  ]);

  if (polls.error) {
    throw new Error(polls.error.message);
  }

  const pollAuthors = new Set(
    ((polls.data || []) as Array<{ author_user_id: string | null }>)
      .map((row) => row.author_user_id)
      .filter(Boolean),
  );

  return {
    publishedPolls: polls.count ?? 0,
    pollAuthors: pollAuthors.size,
    discussionTopicsAndThreads:
      countOrThrow(topics) +
      countOrThrow(projectThreads) +
      countOrThrow(articleThreads) +
      countOrThrow(pollThreads),
    recentNews: countOrThrow(recentNews),
    publicProfiles: countOrThrow(publicProfiles),
  };
}

async function readSectionVisibility(): Promise<SectionVisibility> {
  const supabase = createPublicReadOnlyClient();

  if (!supabase) {
    return ALL_SECTIONS_VISIBLE;
  }

  try {
    return resolveSectionVisibility(await loadSectionCounts(supabase));
  } catch (error) {
    console.error("[section-visibility] counts unavailable:", error);
    return ALL_SECTIONS_VISIBLE;
  }
}

/**
 * Which audience-dependent sections the navigation advertises. Recounted at
 * most once per revalidate window, so the header costs nothing per request.
 */
export const getSectionVisibility = unstable_cache(
  readSectionVisibility,
  ["section-visibility-v1"],
  {
    revalidate: SECTION_VISIBILITY_REVALIDATE_SECONDS,
    tags: [SECTION_VISIBILITY_CACHE_TAG],
  },
);
