import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DISCUSSIONS_CATEGORY_SLUG,
  SECTION_CATEGORY_SLUGS,
} from "@/lib/articles";

async function getCategoryIdsBySlug(
  supabase: SupabaseClient,
  slugs: readonly string[],
): Promise<number[]> {
  const { data } = await supabase
    .from("article_categories")
    .select("id")
    .in("slug", [...slugs]);

  return ((data || []) as Array<{ id: number }>).map((row) => row.id);
}

/**
 * Ids of the categories that own a section of their own (News, Discussions).
 * Returned as a list so callers can exclude them in one filter instead of one
 * lookup per category — the previous shape, which only knew about News.
 */
export async function getSectionCategoryIds(
  supabase: SupabaseClient,
): Promise<number[]> {
  return getCategoryIdsBySlug(supabase, SECTION_CATEGORY_SLUGS);
}

/**
 * Just the Discussions category. Used where News must stay visible — an admin's
 * own dashboard still lists the news they wrote, but nobody's article list
 * should contain discussion topics.
 */
export async function getDiscussionsCategoryIds(
  supabase: SupabaseClient,
): Promise<number[]> {
  return getCategoryIdsBySlug(supabase, [DISCUSSIONS_CATEGORY_SLUG]);
}

/**
 * Drops section-owned categories from an `articles` query while keeping
 * uncategorised rows, which have no section and belong in the generic feed.
 *
 * PostgREST needs the null case spelled out: `category_id.not.in.(…)` alone
 * evaluates to NULL — and therefore filters out — rows with no category.
 */
export function excludeSectionCategories<T>(
  query: T,
  categoryIds: number[],
): T {
  if (categoryIds.length === 0) {
    return query;
  }

  const filter = query as unknown as {
    or: (expression: string) => T;
  };

  return filter.or(
    `category_id.is.null,category_id.not.in.(${categoryIds.join(",")})`,
  );
}
