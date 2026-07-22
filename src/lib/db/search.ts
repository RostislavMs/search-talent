import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCreatorRatings, getProjectRatings } from "@/lib/db/leaderboards";
import type { ProjectKind } from "@/lib/projects";
import { loadAcceptedCoAuthorsMap } from "@/lib/db/co-authors";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";
import {
  getProfileRelevanceScore,
  getProjectRelevanceScore,
  normalizePage,
  normalizePerPage,
  pageOffset,
  profileComparator,
  projectComparator,
} from "@/lib/search-ranking";

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
  kind: string | null;
  kind_metadata: Record<string, unknown> | null;
  role: string | null;
  team_size: number | null;
  project_url: string | null;
  repository_url: string | null;
  started_on: string | null;
  completed_on: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
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

/**
 * Already-parsed discovery search input. The `/api/search` route parses the
 * URLSearchParams into this shape; server components building an initial
 * (SSR) result set construct it directly.
 */
export type DiscoverySearchParams = {
  q?: string;
  scope?: string;
  sort?: string;
  countryId?: number | null;
  categoryId?: number | null;
  skillIds?: number[];
  languageIds?: number[];
  experienceLevel?: string | null;
  employmentTypes?: string[];
  workFormats?: string[];
  projectStatus?: string | null;
  projectKind?: ProjectKind | null;
  hasMedia?: boolean;
  hasAvatar?: boolean;
  minScore?: number | null;
  maxScore?: number | null;
  page?: number | null;
  perPage?: number | null;
};

function getRelationName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null,
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }

  return relation?.name || null;
}

type Rangeable<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

/**
 * Fetch every row matching an `in(ids)` lookup without hitting two silent
 * limits: the request-URL length (chunk the id list) and PostgREST's 1000-row
 * response cap (page each chunk). Both would otherwise truncate quietly once
 * the candidate set / related rows grow past a few hundred, dropping media,
 * skills or languages and skewing the results.
 */
async function fetchAllByIds<T>(
  ids: Array<string | number>,
  build: (chunk: Array<string | number>) => Rangeable<T>,
): Promise<T[]> {
  const ID_CHUNK_SIZE = 200;
  const PAGE_SIZE = 1000;
  const out: T[] = [];

  for (let i = 0; i < ids.length; i += ID_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ID_CHUNK_SIZE);
    let from = 0;

    while (true) {
      const { data, error } = await build(chunk).range(from, from + PAGE_SIZE - 1);

      if (error) {
        // A missing lookup degrades the card (no skills chip, etc.) but must
        // not blow up the whole search response.
        break;
      }

      const rows = data ?? [];
      out.push(...rows);

      if (rows.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }
  }

  return out;
}

/**
 * Core discovery search. Runs every facet filter + text query in SQL (the
 * search_projects / search_profiles RPCs) and computes the composite
 * project/creator ratings + relevance in JS, then sorts and paginates.
 *
 * The caller supplies the Supabase client so the route handler can keep its
 * per-request (cookie) client while server components seeding the SSR view
 * pass the cookie-less public read-only client (the anonymous public view that
 * Googlebot sees).
 */
export async function searchDiscovery(
  params: DiscoverySearchParams,
  supabase: SupabaseClient,
) {
  const q = (params.q || "").trim().toLowerCase();
  const scope = params.scope || "all";
  const sort = params.sort || "relevance";
  const countryId = params.countryId ?? null;
  const categoryId = params.categoryId ?? null;
  const skillIds = params.skillIds ?? [];
  const languageIds = params.languageIds ?? [];
  const experienceLevel = params.experienceLevel ?? null;
  const employmentTypes = params.employmentTypes ?? [];
  const workFormats = params.workFormats ?? [];
  const projectStatus = params.projectStatus ?? null;
  const projectKind = params.projectKind ?? null;
  const hasMedia = params.hasMedia ?? false;
  const hasAvatar = params.hasAvatar ?? false;
  const minScore = params.minScore ?? null;
  const maxScore = params.maxScore ?? null;
  const perPage = normalizePerPage(params.perPage ?? null);
  const page = normalizePage(params.page ?? null);

  const activeSort = sort === "rating" || sort === "newest" ? sort : "relevance";
  // Candidate ordering for the SQL pre-filter: newest rows for the "newest"
  // sort, otherwise the highest-scoring rows, so that capping the candidate set
  // never drops the rows most likely to surface on the first pages.
  const candidateOrder = activeSort === "newest" ? "newest" : "score";
  // Generous cap on the (correctly filtered) candidate set. The composite
  // project rating + relevance are still computed in JS over these candidates.
  const CANDIDATE_LIMIT = 1000;

  // All facet filters + the text query run in SQL (search_projects /
  // search_profiles RPCs), so the candidate set is correctly filtered before
  // the JS rating/relevance/sort step — no more "filter the first 200 rows"
  // bug. Profile score min/max is on the persisted Wilson score (SQL); project
  // min/max is on the composite rating and is applied in JS below. Both entities
  // are always queried so the inactive tab's `totals` count stays accurate; the
  // response zeroes the array the active scope does not need.
  const [projectsResponse, profilesResponse, creatorRatings, projectRatings] = await Promise.all([
    supabase
      .rpc("search_projects", {
        p_q: q || null,
        p_kind: projectKind,
        p_project_status: projectStatus,
        p_skill_ids: skillIds.length > 0 ? skillIds : null,
        p_has_media: hasMedia,
        p_order: candidateOrder,
        p_limit: CANDIDATE_LIMIT,
      })
      .select(
        "id, title, slug, description, score, cover_url, project_status, owner_id, created_at, kind, kind_metadata, role, team_size, project_url, repository_url, started_on, completed_on, problem, solution, results",
      ),
    supabase
      .rpc("search_profiles", {
        p_q: q || null,
        p_country_id: countryId,
        p_category_id: categoryId,
        p_skill_ids: skillIds.length > 0 ? skillIds : null,
        p_language_ids: languageIds.length > 0 ? languageIds : null,
        p_experience_level: experienceLevel,
        p_employment_types: employmentTypes.length > 0 ? employmentTypes : null,
        p_work_formats: workFormats.length > 0 ? workFormats : null,
        p_has_avatar: hasAvatar,
        // Rating min/max for profiles is applied in JS below against the
        // composite creator rating (the value shown on cards and used to
        // sort), not the persisted Wilson-only profiles.score — so the SQL
        // pre-filter must not narrow on that column.
        p_min_score: null,
        p_max_score: null,
        p_order: candidateOrder,
        p_limit: CANDIDATE_LIMIT,
      })
      .select(
        "id, user_id, username, name, headline, avatar_url, country_id, city, category_id, experience_level, employment_types, work_formats, score, created_at",
      ),
    // Composite all-time creator + project ratings keyed by id — the exact
    // values the homepage leaderboard shows. Sharing the leaderboard cache
    // means search rows carry the same rating as /home and cost nothing extra,
    // and we no longer refetch every candidate's votes to recompute it here.
    getCreatorRatings(),
    getProjectRatings(),
  ]);

  const rawProjects = (projectsResponse.data || []) as ProjectRow[];
  const rawProfiles = (profilesResponse.data || []) as ProfileRow[];
  const projectOwnerIds = [...new Set(rawProjects.map((project) => project.owner_id))];
  const profileIds = rawProfiles.map((profile) => profile.id);
  const projectIds = rawProjects.map((project) => project.id);
  const countryIds = [...new Set(rawProfiles.map((profile) => profile.country_id).filter(Boolean))] as number[];
  const categoryIds = [...new Set(rawProfiles.map((profile) => profile.category_id).filter(Boolean))] as number[];

  // Related rows for display / relevance. Project vote totals and media
  // recency are NOT fetched here anymore: the rating shown and sorted on comes
  // straight from the leaderboard's composite `projectRatings` map (same as
  // creators), so votes never need to be paged into this request. Everything
  // below is chunked + paged (fetchAllByIds) so nothing truncates at scale.
  const [
    ownerProfiles,
    projectSkills,
    profileSkills,
    profileLanguages,
    media,
    countries,
    categories,
  ] = await Promise.all([
    fetchAllByIds<{ user_id: string; username: string | null; name: string | null }>(
      projectOwnerIds,
      (chunk) =>
        supabase
          .from("profiles")
          .select("user_id, username, name")
          .in("user_id", chunk) as unknown as Rangeable<{
          user_id: string;
          username: string | null;
          name: string | null;
        }>,
    ),
    fetchAllByIds<ProjectSkillRow>(
      projectIds,
      (chunk) =>
        supabase
          .from("project_skills")
          .select(`project_id, skill_id, skills ( name )`)
          .in("project_id", chunk) as unknown as Rangeable<ProjectSkillRow>,
    ),
    fetchAllByIds<ProfileSkillRow>(
      profileIds,
      (chunk) =>
        supabase
          .from("profile_skills")
          .select(`profile_id, skill_id, skills ( name )`)
          .in("profile_id", chunk) as unknown as Rangeable<ProfileSkillRow>,
    ),
    fetchAllByIds<ProfileLanguageRow>(
      profileIds,
      (chunk) =>
        supabase
          .from("profile_languages")
          .select("profile_id, language_id")
          .in("profile_id", chunk) as unknown as Rangeable<ProfileLanguageRow>,
    ),
    fetchAllByIds<{ project_id: string }>(
      projectIds,
      (chunk) =>
        supabase
          .from("project_media")
          .select("project_id")
          .in("project_id", chunk) as unknown as Rangeable<{ project_id: string }>,
    ),
    fetchAllByIds<CountryRow>(
      countryIds,
      (chunk) =>
        supabase
          .from("countries")
          .select("id, name")
          .in("id", chunk) as unknown as Rangeable<CountryRow>,
    ),
    fetchAllByIds<CategoryRow>(
      categoryIds,
      (chunk) =>
        supabase
          .from("profile_categories")
          .select("id, name")
          .in("id", chunk) as unknown as Rangeable<CategoryRow>,
    ),
  ]);

  const ownerMap = new Map<string, { username: string | null; name: string | null }>();
  for (const row of ownerProfiles) {
    ownerMap.set(row.user_id, {
      username: row.username,
      name: row.name,
    });
  }

  const projectSkillsMap = new Map<string, Array<{ id: number; name: string }>>();
  for (const row of projectSkills) {
    const name = getRelationName(row.skills);

    if (!name) {
      continue;
    }

    const existing = projectSkillsMap.get(row.project_id) || [];
    existing.push({ id: row.skill_id, name });
    projectSkillsMap.set(row.project_id, existing);
  }

  const profileSkillsMap = new Map<string, Array<{ id: number; name: string }>>();
  for (const row of profileSkills) {
    const name = getRelationName(row.skills);

    if (!name) {
      continue;
    }

    const existing = profileSkillsMap.get(row.profile_id) || [];
    existing.push({ id: row.skill_id, name });
    profileSkillsMap.set(row.profile_id, existing);
  }

  const profileLanguageIdsMap = new Map<string, number[]>();
  for (const row of profileLanguages) {
    if (!row.language_id) {
      continue;
    }

    const existing = profileLanguageIdsMap.get(row.profile_id) || [];
    existing.push(row.language_id);
    profileLanguageIdsMap.set(row.profile_id, existing);
  }

  const mediaCountByProject = new Map<string, number>();
  for (const row of media) {
    mediaCountByProject.set(
      row.project_id,
      (mediaCountByProject.get(row.project_id) || 0) + 1,
    );
  }

  const countryMap = new Map<number, string>();
  for (const row of countries) {
    countryMap.set(row.id, row.name);
  }

  const categoryMap = new Map<number, string>();
  for (const row of categories) {
    categoryMap.set(row.id, row.name);
  }

  let projects = rawProjects
    .map((project) => {
      const owner = ownerMap.get(project.owner_id);
      const technologies = projectSkillsMap.get(project.id) || [];
      const mediaCount = mediaCountByProject.get(project.id) || 0;

      // Rating shown + sorted on is the leaderboard's composite all-time rating
      // (community trust + completeness + media + tech + freshness), looked up
      // from the shared cache so it always equals the /home and /top-* value.
      // Falls back to the persisted Wilson score for a freshly published
      // project not yet in the current leaderboard snapshot.
      const rating = projectRatings[project.id] ?? project.score ?? 0;

      return {
        ...project,
        slug: project.slug || "",
        score: rating,
        ownerName: owner?.name ?? null,
        ownerUsername: owner?.username ?? null,
        coAuthorNames: [] as string[],
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
      // Facet + text filters (status, kind, skills, hasMedia, q) run in SQL via
      // search_projects. Only the composite-rating range is applied here,
      // because that rating comes from the leaderboard map (not the SQL score).
      if (typeof minScore === "number" && (project.score ?? 0) < minScore) {
        return false;
      }

      if (typeof maxScore === "number" && (project.score ?? 0) > maxScore) {
        return false;
      }

      return true;
    });

  // Co-author display names (owner excluded) for the project cards.
  if (projects.length > 0) {
    const projectCoAuthors = await loadAcceptedCoAuthorsMap(
      supabase,
      "project",
      projects.map((project) => project.id),
    );
    for (const project of projects) {
      project.coAuthorNames = (projectCoAuthors.get(project.id) ?? [])
        .map((author) => author.name || author.username || "")
        .filter(Boolean);
    }
  }

  let users = rawProfiles
    .map((profile) => {
      const technologies = profileSkillsMap.get(profile.id) || [];
      const countryName = profile.country_id ? countryMap.get(profile.country_id) || null : null;
      const categoryName = profile.category_id ? categoryMap.get(profile.category_id) || null : null;

      return {
        ...profile,
        username: profile.username || "",
        // Use the composite leaderboard rating (completeness + portfolio +
        // community trust + production + tech + freshness + badges) instead of
        // the persisted Wilson-only profiles.score, so the card rating and the
        // "sort by rating" order match the homepage leaderboard. Falls back to
        // the persisted score if the leaderboard map is unavailable.
        score: creatorRatings[profile.id] ?? profile.score ?? 0,
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
      // Rating range filters against the composite rating set above (matching
      // the value shown on the card), mirroring how project min/max is applied.
      if (typeof minScore === "number" && (profile.score ?? 0) < minScore) {
        return false;
      }

      if (typeof maxScore === "number" && (profile.score ?? 0) > maxScore) {
        return false;
      }

      return true;
    });

  const totals = {
    projects: projects.length,
    users: users.length,
  };

  // `totals` above holds the full filtered counts; here we return just the
  // requested page so the client can render numbered pagination.
  const offset = pageOffset(page, perPage);
  projects = projects
    .sort(projectComparator(activeSort))
    .slice(offset, offset + perPage);
  users = users
    .sort(profileComparator(activeSort))
    .slice(offset, offset + perPage);

  return {
    projects: scope === "creators" ? [] : projects,
    users: scope === "projects" ? [] : users,
    totals,
  };
}

/**
 * SSR seed for the discovery pages: runs the default first-page query through
 * the cookie-less public read-only client (the anonymous view Googlebot sees,
 * and safe inside statically-generated / ISR pages). Returns null when the
 * public client is unavailable or the query fails, so the caller falls back to
 * the client-only render instead of erroring the page.
 */
export async function getInitialDiscoveryResults(params: DiscoverySearchParams) {
  const supabase = createPublicReadOnlyClient();

  if (!supabase) {
    return null;
  }

  try {
    return await searchDiscovery(params, supabase);
  } catch {
    return null;
  }
}
