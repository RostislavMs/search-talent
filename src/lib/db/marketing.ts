import { getArticleFeed } from "@/lib/db/articles";
import { getLeaderboards } from "@/lib/db/leaderboards";
import { slugifySegment } from "@/lib/marketing-content";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getPublicReadClient() {
  const publicClient = createPublicReadOnlyClient();

  if (publicClient) {
    return publicClient;
  }

  return await createClient();
}

export async function getPopularTechnologies(limit = 20) {
  const supabase = await getPublicReadClient();
  // Combined project + profile skill popularity, aggregated in SQL.
  const { data } = await supabase
    .from("skill_directory_stats")
    .select("id, name, combined_count")
    .order("combined_count", { ascending: false })
    .order("name", { ascending: true })
    .limit(limit);

  return ((data || []) as Array<{ id: number; name: string; combined_count: number }>).map(
    (skill) => ({ id: skill.id, name: skill.name, count: skill.combined_count }),
  );
}

export async function getFeaturedTalents(limit = 8) {
  const leaderboards = await getLeaderboards();

  return leaderboards.creators.all.slice(0, limit).map((creator) => ({
    username: creator.username,
    name: creator.name,
    headline: creator.headline,
    avatar_url: creator.avatar_url,
  }));
}

export async function getLatestArticles(limit = 6, locale?: string | null) {
  const feed = await getArticleFeed({ sort: "recent", locale });
  return feed.items.slice(0, limit);
}

export type TechnologyDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

/**
 * Technology directory scoped to projects only, with each count being the
 * number of public (approved + published) projects that list the skill.
 * Powers the /projects/tag landing pages and the "browse by technology"
 * section. `getPopularTechnologies` counts projects + profiles combined,
 * which would surface profile-only skills that have zero matching projects.
 */
export async function getTechnologyDirectory(
  limit?: number,
): Promise<TechnologyDirectoryItem[]> {
  const supabase = await getPublicReadClient();
  // Per-skill count of approved + published projects, aggregated in SQL.
  let query = supabase
    .from("skill_directory_stats")
    .select("id, name, project_count")
    .order("project_count", { ascending: false })
    .order("name", { ascending: true });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data } = await query;

  return ((data || []) as Array<{ id: number; name: string; project_count: number }>).map(
    (skill) => ({
      id: skill.id,
      name: skill.name,
      slug: slugifySegment(skill.name),
      count: skill.project_count,
    }),
  );
}

export async function getTechnologyBySlug(techSlug: string) {
  const items = await getTechnologyDirectory();
  return items.find((item) => item.slug === techSlug) || null;
}

/**
 * Count of public (approved + published) projects per `kind`. Powers the
 * /projects/type landing pages and the "browse by type" section. The kind
 * value is already URL-safe, so it doubles as the slug.
 */
export async function getProjectKindDirectory(): Promise<
  Array<{ kind: string; count: number }>
> {
  const supabase = await getPublicReadClient();
  const { data } = await supabase
    .from("project_kind_directory_stats")
    .select("kind, total")
    .order("total", { ascending: false });

  return ((data || []) as Array<{ kind: string; total: number }>).map((row) => ({
    kind: row.kind,
    count: row.total,
  }));
}

export type DirectoryCreator = {
  username: string;
  name: string | null;
  headline: string | null;
  avatarUrl: string | null;
  city: string | null;
  countryName: string | null;
  categoryName: string | null;
  score: number | null;
};

export async function getCreatorsBySkillId(
  skillId: number,
  limit = 24,
): Promise<DirectoryCreator[]> {
  const supabase = await getPublicReadClient();
  // Public creators that list the skill, with country/category names joined and
  // the page limit applied in SQL (was: fetch every matching profile, filter
  // moderation + resolve names in JS, then slice).
  const { data } = await supabase
    .from("creator_skill_directory")
    .select("username, name, headline, avatar_url, city, country_name, category_name")
    .eq("skill_id", skillId)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  return ((data || []) as Array<{
    username: string;
    name: string | null;
    headline: string | null;
    avatar_url: string | null;
    city: string | null;
    country_name: string | null;
    category_name: string | null;
  }>).map((row) => ({
    username: row.username,
    name: row.name,
    headline: row.headline,
    avatarUrl: row.avatar_url,
    city: row.city,
    countryName: row.country_name,
    categoryName: row.category_name,
    score: null,
  }));
}

export type DirectoryProject = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  coverUrl: string | null;
  score: number | null;
  ownerName: string | null;
  ownerUsername: string | null;
};

export async function getProjectsBySkillId(
  skillId: number,
  limit = 24,
): Promise<DirectoryProject[]> {
  const supabase = await getPublicReadClient();
  // Approved + published projects that list the skill, with owner name/username
  // joined and the limit applied in SQL (was: fetch all matching project ids,
  // re-query with a large .in() list, then resolve owners separately).
  const { data } = await supabase
    .from("project_skill_directory")
    .select(
      "id, owner_id, title, slug, description, cover_url, score, kind, owner_name, owner_username",
    )
    .eq("skill_id", skillId)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  return ((data || []) as Array<{
    id: string;
    owner_id: string;
    title: string;
    slug: string | null;
    description: string | null;
    cover_url: string | null;
    score: number | null;
    kind: string | null;
    owner_name: string | null;
    owner_username: string | null;
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    coverUrl: row.cover_url,
    score: row.score,
    kind: row.kind,
    ownerName: row.owner_name,
    ownerUsername: row.owner_username,
  }));
}

/**
 * Skill directory scoped to talents only, with each count being the number of
 * public profiles that list the skill. Used by the /talents/skill landing
 * pages and the "browse by skill" section. Only public (listed username +
 * public moderation status) profiles are counted, so a skill that exists only
 * on hidden profiles never surfaces an empty page.
 */
export async function getTalentSkillDirectory(): Promise<
  TechnologyDirectoryItem[]
> {
  const supabase = await getPublicReadClient();
  // Per-skill count of public profiles, aggregated in SQL.
  const { data } = await supabase
    .from("skill_directory_stats")
    .select("id, name, profile_count")
    .order("profile_count", { ascending: false })
    .order("name", { ascending: true });

  return ((data || []) as Array<{ id: number; name: string; profile_count: number }>).map(
    (skill) => ({
      id: skill.id,
      name: skill.name,
      slug: slugifySegment(skill.name),
      count: skill.profile_count,
    }),
  );
}

export async function getTalentSkillBySlug(skillSlug: string) {
  const items = await getTalentSkillDirectory();
  return items.find((item) => item.slug === skillSlug) || null;
}

export type ProfileCategoryDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

/**
 * Profile categories (a.k.a. roles/directions) with a slugified name and a
 * count of public talents in each. Powers the /talents/role/[role] pages.
 * Categories carry no slug column in the DB, so we derive one from the name
 * the same way technologies do.
 */
export async function getProfileCategoryDirectory(): Promise<
  ProfileCategoryDirectoryItem[]
> {
  const supabase = await getPublicReadClient();
  // Per-category count of public talents, aggregated in SQL.
  const { data } = await supabase
    .from("profile_category_directory_stats")
    .select("id, name, total")
    .order("name", { ascending: true });

  return ((data || []) as Array<{ id: number; name: string; total: number }>).map(
    (category) => ({
      id: category.id,
      name: category.name,
      slug: slugifySegment(category.name),
      count: category.total,
    }),
  );
}

export async function getProfileCategoryBySlug(categorySlug: string) {
  const items = await getProfileCategoryDirectory();
  return items.find((item) => item.slug === categorySlug) || null;
}

export type ArticleCategoryDirectoryItem = {
  id: number;
  slug: string;
  name: string;
  nameUk: string | null;
  adminOnly: boolean;
};

export async function getArticleCategoryDirectory(): Promise<
  ArticleCategoryDirectoryItem[]
> {
  const supabase = await getPublicReadClient();
  const { data } = await supabase
    .from("article_categories")
    .select("id, slug, name, name_uk, admin_only")
    .order("name", { ascending: true });

  return ((data || []) as Array<{
    id: number;
    slug: string;
    name: string;
    name_uk: string | null;
    admin_only: boolean | null;
  }>).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameUk: row.name_uk,
    adminOnly: Boolean(row.admin_only),
  }));
}

export async function getArticleCategoryBySlug(slug: string) {
  const supabase = await getPublicReadClient();
  const { data } = await supabase
    .from("article_categories")
    .select("id, slug, name, name_uk, description, admin_only")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as {
    id: number;
    slug: string;
    name: string;
    name_uk: string | null;
    description: string | null;
    admin_only: boolean | null;
  };

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameUk: row.name_uk,
    description: row.description,
    adminOnly: Boolean(row.admin_only),
  };
}
