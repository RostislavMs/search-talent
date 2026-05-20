import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  score: number | null;
  cover_url: string | null;
  project_status: string | null;
  owner_id: string;
  created_at: string | null;
  moderation_status: string | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  headline: string | null;
  avatar_url: string | null;
  country_id: number | null;
  city: string | null;
  category_id: number | null;
  experience_level: string | null;
  employment_types: string[] | null;
  work_formats: string[] | null;
  moderation_status: string | null;
  score: number | null;
  created_at: string | null;
};

type ProjectSkillRow = {
  project_id: string;
  skill_id: number;
  skills: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type ProfileSkillRow = {
  profile_id: string;
  skill_id: number;
  skills: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type ProfileLanguageRow = {
  profile_id: string;
  language_id: number | null;
};

type CountryRow = {
  id: number;
  name: string;
};

type CategoryRow = {
  id: number;
  name: string;
};

function getRelationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null,
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }

  return relation?.name || null;
}

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseNumberArray(value: string | null) {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0),
  )];
}

function parseStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function matchesQuery(value: string | null | undefined, query: string) {
  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(query);
}

function getProjectRelevanceScore(
  project: {
    title: string;
    description: string | null;
    ownerName: string | null;
    ownerUsername: string | null;
    technologies: string[];
  },
  query: string,
) {
  if (!query) {
    return 0;
  }

  let score = 0;

  if (matchesQuery(project.title, query)) {
    score += project.title.toLowerCase() === query ? 12 : 8;
  }

  if (matchesQuery(project.description, query)) {
    score += 4;
  }

  if (matchesQuery(project.ownerName, query) || matchesQuery(project.ownerUsername, query)) {
    score += 2;
  }

  if (project.technologies.some((item) => matchesQuery(item, query))) {
    score += 3;
  }

  return score;
}

function getProfileRelevanceScore(
  profile: {
    username: string;
    name: string | null;
    headline: string | null;
    technologies: string[];
    countryName: string | null;
  },
  query: string,
) {
  if (!query) {
    return 0;
  }

  let score = 0;

  if (matchesQuery(profile.username, query)) {
    score += profile.username.toLowerCase() === query ? 12 : 8;
  }

  if (matchesQuery(profile.name, query)) {
    score += 6;
  }

  if (matchesQuery(profile.headline, query)) {
    score += 4;
  }

  if (matchesQuery(profile.countryName, query)) {
    score += 2;
  }

  if (profile.technologies.some((item) => matchesQuery(item, query))) {
    score += 3;
  }

  return score;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const scope = searchParams.get("scope") || "all";
  const sort = searchParams.get("sort") || "relevance";
  const countryId = parseNumber(searchParams.get("countryId"));
  const categoryId = parseNumber(searchParams.get("categoryId"));
  const skillIds = parseNumberArray(searchParams.get("skillIds"));
  const languageIds = parseNumberArray(searchParams.get("languageIds"));
  const experienceLevel = (searchParams.get("experienceLevel") || "").trim() || null;
  const employmentTypes = parseStringArray(searchParams.get("employmentTypes"));
  const workFormats = parseStringArray(searchParams.get("workFormats"));
  const projectStatus = (searchParams.get("projectStatus") || "").trim() || null;
  const hasMedia = searchParams.get("hasMedia") === "1";
  const hasAvatar = searchParams.get("hasAvatar") === "1";
  const minScore = parseNumber(searchParams.get("minScore"));
  const maxScore = parseNumber(searchParams.get("maxScore"));

  const supabase = await createClient();

  let projectQuery = supabase
    .from("projects")
    .select(
      "id, title, slug, description, score, cover_url, project_status, owner_id, created_at, moderation_status",
    )
    .eq("status", "published");

  let profileQuery = supabase
    .from("profiles")
    .select("id, user_id, username, name, headline, avatar_url, country_id, city, category_id, experience_level, employment_types, work_formats, moderation_status, score, created_at")
    .not("username", "is", null);

  if (typeof minScore === "number") {
    projectQuery = projectQuery.gte("score", minScore);
    profileQuery = profileQuery.gte("score", minScore);
  }

  if (typeof maxScore === "number") {
    projectQuery = projectQuery.lte("score", maxScore);
    profileQuery = profileQuery.lte("score", maxScore);
  }

  const [
    projectsResponse,
    profilesResponse,
  ] = await Promise.all([
    projectQuery.limit(200),
    profileQuery.limit(200),
  ]);

  const rawProjects = (projectsResponse.data || []) as ProjectRow[];
  const rawProfiles = (profilesResponse.data || []) as ProfileRow[];
  const projectOwnerIds = [...new Set(rawProjects.map((project) => project.owner_id))];
  const profileIds = rawProfiles.map((profile) => profile.id);
  const projectIds = rawProjects.map((project) => project.id);
  const countryIds = [...new Set(rawProfiles.map((profile) => profile.country_id).filter(Boolean))] as number[];
  const categoryIds = [...new Set(rawProfiles.map((profile) => profile.category_id).filter(Boolean))] as number[];

  const [
    ownerProfilesResponse,
    projectSkillsResponse,
    profileSkillsResponse,
    profileLanguagesResponse,
    mediaResponse,
    countriesResponse,
    categoriesResponse,
  ] = await Promise.all([
    projectOwnerIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id, username, name")
          .in("user_id", projectOwnerIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase
          .from("project_skills")
          .select(
            `
            project_id,
            skill_id,
            skills (
              name
            )
          `,
          )
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
    profileIds.length > 0
      ? supabase
          .from("profile_skills")
          .select(
            `
            profile_id,
            skill_id,
            skills (
              name
            )
          `,
          )
          .in("profile_id", profileIds)
      : Promise.resolve({ data: [] }),
    profileIds.length > 0
      ? supabase
          .from("profile_languages")
          .select("profile_id, language_id")
          .in("profile_id", profileIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? supabase
          .from("project_media")
          .select("project_id")
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
    countryIds.length > 0
      ? supabase
          .from("countries")
          .select("id, name")
          .in("id", countryIds)
      : Promise.resolve({ data: [] }),
    categoryIds.length > 0
      ? supabase
          .from("profile_categories")
          .select("id, name")
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
  ]);

  const ownerMap = new Map<string, { username: string | null; name: string | null }>();
  for (const row of (ownerProfilesResponse.data || []) as Array<{
    user_id: string;
    username: string | null;
    name: string | null;
  }>) {
    ownerMap.set(row.user_id, {
      username: row.username,
      name: row.name,
    });
  }

  const projectSkillsMap = new Map<string, Array<{ id: number; name: string }>>();
  for (const row of (projectSkillsResponse.data || []) as ProjectSkillRow[]) {
    const name = getRelationName(row.skills);

    if (!name) {
      continue;
    }

    const existing = projectSkillsMap.get(row.project_id) || [];
    existing.push({ id: row.skill_id, name });
    projectSkillsMap.set(row.project_id, existing);
  }

  const profileSkillsMap = new Map<string, Array<{ id: number; name: string }>>();
  for (const row of (profileSkillsResponse.data || []) as ProfileSkillRow[]) {
    const name = getRelationName(row.skills);

    if (!name) {
      continue;
    }

    const existing = profileSkillsMap.get(row.profile_id) || [];
    existing.push({ id: row.skill_id, name });
    profileSkillsMap.set(row.profile_id, existing);
  }

  const profileLanguageIdsMap = new Map<string, number[]>();
  for (const row of (profileLanguagesResponse.data || []) as ProfileLanguageRow[]) {
    if (!row.language_id) {
      continue;
    }

    const existing = profileLanguageIdsMap.get(row.profile_id) || [];
    existing.push(row.language_id);
    profileLanguageIdsMap.set(row.profile_id, existing);
  }

  const mediaCountByProject = new Map<string, number>();
  for (const row of (mediaResponse.data || []) as Array<{ project_id: string }>) {
    mediaCountByProject.set(
      row.project_id,
      (mediaCountByProject.get(row.project_id) || 0) + 1,
    );
  }

  const countryMap = new Map<number, string>();
  for (const row of (countriesResponse.data || []) as CountryRow[]) {
    countryMap.set(row.id, row.name);
  }

  const categoryMap = new Map<number, string>();
  for (const row of (categoriesResponse.data || []) as CategoryRow[]) {
    categoryMap.set(row.id, row.name);
  }

  let projects = rawProjects
    .filter((project) => isPublicModerationStatus(project.moderation_status))
    .map((project) => {
      const owner = ownerMap.get(project.owner_id);
      const technologies = projectSkillsMap.get(project.id) || [];
      const mediaCount = mediaCountByProject.get(project.id) || 0;
      return {
        ...project,
        slug: project.slug || "",
        ownerName: owner?.name ?? null,
        ownerUsername: owner?.username ?? null,
        technologies,
        mediaCount,
        relevance: getProjectRelevanceScore(
          {
            title: project.title,
            description: project.description,
            ownerName: owner?.name ?? null,
            ownerUsername: owner?.username ?? null,
            technologies: technologies.map((item) => item.name),
          },
          q,
        ),
      };
    })
    .filter((project) => Boolean(project.slug))
    .filter((project) => {
      if (q) {
        const queryMatches =
          project.relevance > 0 ||
          matchesQuery(project.title, q) ||
          matchesQuery(project.description, q);

        if (!queryMatches) {
          return false;
        }
      }

      if (projectStatus && project.project_status !== projectStatus) {
        return false;
      }

      if (
        skillIds.length > 0 &&
        !project.technologies.some((item) => skillIds.includes(item.id))
      ) {
        return false;
      }

      if (hasMedia && project.mediaCount === 0) {
        return false;
      }

      return true;
    });

  let users = rawProfiles
    .filter((profile) => isPublicModerationStatus(profile.moderation_status))
    .filter((profile) => Boolean(profile.username))
    .map((profile) => {
      const technologies = profileSkillsMap.get(profile.id) || [];
      const countryName = profile.country_id ? countryMap.get(profile.country_id) || null : null;
      const categoryName = profile.category_id ? categoryMap.get(profile.category_id) || null : null;

      return {
        ...profile,
        username: profile.username || "",
        technologies,
        countryName,
        categoryName,
        languageIds: profileLanguageIdsMap.get(profile.id) || [],
        relevance: getProfileRelevanceScore(
          {
            username: profile.username || "",
            name: profile.name,
            headline: profile.headline,
            technologies: technologies.map((item) => item.name),
            countryName,
          },
          q,
        ),
      };
    })
    .filter((profile) => {
      if (q) {
        const queryMatches =
          profile.relevance > 0 ||
          matchesQuery(profile.username, q) ||
          matchesQuery(profile.name, q) ||
          matchesQuery(profile.headline, q);

        if (!queryMatches) {
          return false;
        }
      }

      if (countryId && profile.country_id !== countryId) {
        return false;
      }

      if (categoryId && profile.category_id !== categoryId) {
        return false;
      }

      if (
        skillIds.length > 0 &&
        !profile.technologies.some((item) => skillIds.includes(item.id))
      ) {
        return false;
      }

      if (
        languageIds.length > 0 &&
        !profile.languageIds.some((item) => languageIds.includes(item))
      ) {
        return false;
      }

      if (experienceLevel && profile.experience_level !== experienceLevel) {
        return false;
      }

      if (
        employmentTypes.length > 0 &&
        !employmentTypes.some((item) => (profile.employment_types || []).includes(item))
      ) {
        return false;
      }

      if (
        workFormats.length > 0 &&
        !workFormats.some((item) => (profile.work_formats || []).includes(item))
      ) {
        return false;
      }

      if (hasAvatar && !profile.avatar_url) {
        return false;
      }

      return true;
    });

  const projectSorters = {
    relevance: (left: (typeof projects)[number], right: (typeof projects)[number]) =>
      right.relevance - left.relevance || (right.score ?? 0) - (left.score ?? 0),
    rating: (left: (typeof projects)[number], right: (typeof projects)[number]) =>
      (right.score ?? 0) - (left.score ?? 0) || right.relevance - left.relevance,
    newest: (left: (typeof projects)[number], right: (typeof projects)[number]) =>
      new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime(),
  } as const;

  const profileSorters = {
    relevance: (left: (typeof users)[number], right: (typeof users)[number]) =>
      right.relevance - left.relevance ||
      (right.score ?? 0) - (left.score ?? 0) ||
      (left.name || left.username).localeCompare(right.name || right.username),
    rating: (left: (typeof users)[number], right: (typeof users)[number]) =>
      (right.score ?? 0) - (left.score ?? 0) ||
      right.relevance - left.relevance,
    newest: (left: (typeof users)[number], right: (typeof users)[number]) =>
      new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime(),
  } as const;

  const activeSort = sort === "rating" || sort === "newest" ? sort : "relevance";
  const totals = {
    projects: projects.length,
    users: users.length,
  };

  projects = projects.sort(projectSorters[activeSort]).slice(0, 24);
  users = users.sort(profileSorters[activeSort]).slice(0, 24);

  return NextResponse.json({
    projects: scope === "creators" ? [] : projects,
    users: scope === "projects" ? [] : users,
    totals,
  });
}
