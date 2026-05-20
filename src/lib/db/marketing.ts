import { getArticleFeed } from "@/lib/db/articles";
import { getLeaderboards } from "@/lib/db/leaderboards";
import { slugifySegment } from "@/lib/marketing-content";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPublicModerationStatus } from "@/lib/moderation";

async function getPublicReadClient() {
  const publicClient = createPublicReadOnlyClient();

  if (publicClient) {
    return publicClient;
  }

  return await createClient();
}

export type RoleDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

export async function getRoleDirectory(limit?: number) {
  const supabase = await getPublicReadClient();
  const [{ data: categories }, { data: profiles }] = await Promise.all([
    supabase.from("profile_categories").select("id, name").order("name"),
    supabase
      .from("profiles")
      .select("category_id")
      .not("username", "is", null)
      .eq("moderation_status", "approved"),
  ]);

  const counts = new Map<number, number>();

  for (const row of (profiles || []) as Array<{ category_id: number | null }>) {
    if (!row.category_id) {
      continue;
    }

    counts.set(row.category_id, (counts.get(row.category_id) || 0) + 1);
  }

  const items = ((categories || []) as Array<{ id: number; name: string }>).map(
    (category) => ({
      id: category.id,
      name: category.name,
      slug: slugifySegment(category.name),
      count: counts.get(category.id) || 0,
    }),
  );

  items.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));

  return typeof limit === "number" ? items.slice(0, limit) : items;
}

export async function getRoleBySlug(roleSlug: string) {
  const roles = await getRoleDirectory();
  return roles.find((role) => role.slug === roleSlug) || null;
}

export async function getPopularTechnologies(limit = 20) {
  const supabase = await getPublicReadClient();
  const [{ data: skills }, { data: projectSkills }, { data: profileSkills }] =
    await Promise.all([
      supabase.from("skills").select("id, name"),
      supabase.from("project_skills").select("skill_id"),
      supabase.from("profile_skills").select("skill_id"),
    ]);

  const counts = new Map<number, number>();

  for (const row of [
    ...((projectSkills || []) as Array<{ skill_id: number }>),
    ...((profileSkills || []) as Array<{ skill_id: number }>),
  ]) {
    counts.set(row.skill_id, (counts.get(row.skill_id) || 0) + 1);
  }

  return ((skills || []) as Array<{ id: number; name: string }>)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      count: counts.get(skill.id) || 0,
    }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
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

export async function getLatestArticles(limit = 6) {
  const feed = await getArticleFeed({ sort: "recent" });
  return feed.items.slice(0, limit);
}

export type TechnologyDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  count: number;
};

export async function getTechnologyDirectory(limit?: number) {
  const items = await getPopularTechnologies(limit ?? 200);
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    slug: slugifySegment(item.name),
    count: item.count,
  }));
}

export async function getTechnologyBySlug(techSlug: string) {
  const items = await getTechnologyDirectory();
  return items.find((item) => item.slug === techSlug) || null;
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

export async function getCreatorsByCategoryId(
  categoryId: number,
  limit = 24,
): Promise<DirectoryCreator[]> {
  const supabase = await getPublicReadClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "username, name, headline, avatar_url, city, country_id, category_id, moderation_status",
    )
    .eq("category_id", categoryId)
    .not("username", "is", null)
    .order("name", { ascending: true })
    .limit(limit * 2);

  const rows = ((data || []) as Array<{
    username: string | null;
    name: string | null;
    headline: string | null;
    avatar_url: string | null;
    city: string | null;
    country_id: number | null;
    category_id: number | null;
    moderation_status: string | null;
  }>).filter(
    (row) => row.username && isPublicModerationStatus(row.moderation_status),
  );

  const countryIds = Array.from(
    new Set(
      rows
        .map((row) => row.country_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const categoryIds = Array.from(
    new Set(
      rows
        .map((row) => row.category_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );

  const [countriesResponse, categoriesResponse] = await Promise.all([
    countryIds.length > 0
      ? supabase.from("countries").select("id, name").in("id", countryIds)
      : Promise.resolve({ data: [] }),
    categoryIds.length > 0
      ? supabase
          .from("profile_categories")
          .select("id, name")
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
  ]);

  const countryMap = new Map(
    ((countriesResponse.data || []) as Array<{ id: number; name: string }>).map(
      (row) => [row.id, row.name],
    ),
  );
  const categoryMap = new Map(
    ((categoriesResponse.data || []) as Array<{ id: number; name: string }>).map(
      (row) => [row.id, row.name],
    ),
  );

  return rows.slice(0, limit).map((row) => ({
    username: row.username!,
    name: row.name,
    headline: row.headline,
    avatarUrl: row.avatar_url,
    city: row.city,
    countryName: row.country_id ? countryMap.get(row.country_id) || null : null,
    categoryName: row.category_id ? categoryMap.get(row.category_id) || null : null,
    score: null,
  }));
}

export async function getCreatorsBySkillId(
  skillId: number,
  limit = 24,
): Promise<DirectoryCreator[]> {
  const supabase = await getPublicReadClient();
  const { data: profileSkills } = await supabase
    .from("profile_skills")
    .select("profile_id")
    .eq("skill_id", skillId);

  const profileIds = Array.from(
    new Set(
      ((profileSkills || []) as Array<{ profile_id: string }>).map(
        (row) => row.profile_id,
      ),
    ),
  );

  if (profileIds.length === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "id, username, name, headline, avatar_url, city, country_id, category_id, moderation_status",
    )
    .in("id", profileIds)
    .not("username", "is", null);

  const rows = ((profiles || []) as Array<{
    id: string;
    username: string | null;
    name: string | null;
    headline: string | null;
    avatar_url: string | null;
    city: string | null;
    country_id: number | null;
    category_id: number | null;
    moderation_status: string | null;
  }>).filter(
    (row) => row.username && isPublicModerationStatus(row.moderation_status),
  );

  const countryIds = Array.from(
    new Set(
      rows
        .map((row) => row.country_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const categoryIds = Array.from(
    new Set(
      rows
        .map((row) => row.category_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );

  const [countriesResponse, categoriesResponse] = await Promise.all([
    countryIds.length > 0
      ? supabase.from("countries").select("id, name").in("id", countryIds)
      : Promise.resolve({ data: [] }),
    categoryIds.length > 0
      ? supabase
          .from("profile_categories")
          .select("id, name")
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
  ]);

  const countryMap = new Map(
    ((countriesResponse.data || []) as Array<{ id: number; name: string }>).map(
      (row) => [row.id, row.name],
    ),
  );
  const categoryMap = new Map(
    ((categoriesResponse.data || []) as Array<{ id: number; name: string }>).map(
      (row) => [row.id, row.name],
    ),
  );

  return rows.slice(0, limit).map((row) => ({
    username: row.username!,
    name: row.name,
    headline: row.headline,
    avatarUrl: row.avatar_url,
    city: row.city,
    countryName: row.country_id ? countryMap.get(row.country_id) || null : null,
    categoryName: row.category_id ? categoryMap.get(row.category_id) || null : null,
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
  const { data: projectSkills } = await supabase
    .from("project_skills")
    .select("project_id")
    .eq("skill_id", skillId);

  const projectIds = Array.from(
    new Set(
      ((projectSkills || []) as Array<{ project_id: string }>).map(
        (row) => row.project_id,
      ),
    ),
  );

  if (projectIds.length === 0) {
    return [];
  }

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, owner_id, title, slug, description, cover_url, score, moderation_status",
    )
    .in("id", projectIds)
    .eq("moderation_status", "approved")
    .eq("status", "published")
    .order("score", { ascending: false })
    .limit(limit);

  const rows = ((projects || []) as Array<{
    id: string;
    owner_id: string;
    title: string;
    slug: string | null;
    description: string | null;
    cover_url: string | null;
    score: number | null;
    moderation_status: string | null;
  }>);

  const ownerIds = Array.from(new Set(rows.map((row) => row.owner_id)));
  const { data: owners } = ownerIds.length > 0
    ? await supabase
        .from("profiles")
        .select("user_id, username, name")
        .in("user_id", ownerIds)
    : { data: [] };

  const ownerMap = new Map(
    ((owners || []) as Array<{ user_id: string; username: string | null; name: string | null }>).map(
      (row) => [row.user_id, row],
    ),
  );

  return rows.map((row) => {
    const owner = ownerMap.get(row.owner_id);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      coverUrl: row.cover_url,
      score: row.score,
      ownerName: owner?.name || null,
      ownerUsername: owner?.username || null,
    };
  });
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
