import "server-only";

import { unstable_cache } from "next/cache";
import {
  awardBadgeByKey,
  getBadgeCountsForUsers,
} from "@/lib/db/badges";
import {
  COMPLETE_PROFILE_BADGE_THRESHOLD,
  RECOGNITION_MIN_POOL,
  RISING_STAR_MONTHLY_THRESHOLD,
  TOP_10_THRESHOLD,
  TOP_100_THRESHOLD,
  type BadgeKey,
} from "@/lib/constants/badges";
import {
  calculateProjectRating,
  calculateUserRating,
  getProfileCompletenessScore,
  getProjectCompletenessScore,
  isWithinTimeframe,
  type LeaderboardTimeframe,
} from "@/lib/leaderboards";
import { getBadgeBonusPoints } from "@/lib/db/badges";
import { loadAcceptedCoAuthorsMap } from "@/lib/db/co-authors";
import { createAdminClient, createPublicReadOnlyClient } from "@/lib/supabase/admin";

// ---- row types ------------------------------------------------------------
//
// These mirror the aggregate views leaderboard_project_stats /
// leaderboard_profile_stats (see supabase/23_leaderboard_stat_views.sql). The
// views compute all vote / media / skill / section counts in Postgres so the
// leaderboard reads one compact row per project / profile instead of paging
// the entire votes / media / skills / section tables into memory.

type ProjectStatsRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  description: string | null;
  role: string | null;
  kind: string | null;
  kind_metadata: Record<string, unknown> | null;
  project_status: string | null;
  team_size: number | null;
  project_url: string | null;
  repository_url: string | null;
  started_on: string | null;
  completed_on: string | null;
  problem: string | null;
  solution: string | null;
  results: string | null;
  cover_url: string | null;
  created_at: string | null;
  likes: number;
  dislikes: number;
  recent_likes: number;
  recent_dislikes: number;
  media_count: number;
  recent_media_count: number;
  tech_count: number;
};

type ProfileStatsRow = {
  id: string;
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  country_id: number | null;
  city: string | null;
  website: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
  behance: string | null;
  dribbble: string | null;
  artstation: string | null;
  vimeo: string | null;
  youtube: string | null;
  instagram: string | null;
  contact_email: string | null;
  telegram_username: string | null;
  phone: string | null;
  preferred_contact_method: string | null;
  experience_level: string | null;
  experience_years: number | null;
  employment_types: string[] | null;
  work_formats: string[] | null;
  salary_expectations: string | null;
  salary_currency: string | null;
  additional_info: string | null;
  profile_likes: number;
  profile_dislikes: number;
  recent_profile_likes: number;
  recent_profile_dislikes: number;
  skills_count: number;
  languages_count: number;
  education_count: number;
  certificate_count: number;
  qa_count: number;
  work_experience_count: number;
  unified_tech_count: number;
};

// ---- public types ---------------------------------------------------------

export type RankedProject = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  rating: number;
  likes: number;
  dislikes: number;
  monthlyLikes: number;
  monthlyDislikes: number;
  mediaCount: number;
  technologyCount: number;
  /** Display names of accepted co-authors (excludes the owner). */
  coAuthorNames: string[];
};

export type RankedCreator = {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  headline: string | null;
  rating: number;
  profileCompleteness: number;
  profileLikes: number;
  profileDislikes: number;
  projectCount: number;
  topProjectTitle: string | null;
  topProjectScore: number;
};

export type LeaderboardsResult = {
  creators: Record<LeaderboardTimeframe, RankedCreator[]>;
  projects: Record<LeaderboardTimeframe, RankedProject[]>;
};

type LeaderboardData = {
  // The public top-10 lists consumed by the homepage / top-* routes.
  result: LeaderboardsResult;
  // All-time composite creator rating keyed by profile id. Exposed so other
  // surfaces (e.g. the talents search) can rank/display the SAME rating as the
  // homepage leaderboard instead of the persisted Wilson-only profiles.score.
  creatorRatings: Record<string, number>;
  // All-time composite project rating keyed by project id. Same purpose as
  // creatorRatings: profile project sections, the user projects page and the
  // related-projects section all display this composite rating instead of the
  // persisted Wilson-only projects.score.
  projectRatings: Record<string, number>;
};

// ---- helpers --------------------------------------------------------------

export const LEADERBOARDS_CACHE_TAG = "leaderboards";
export const LEADERBOARDS_CACHE_REVALIDATE_SECONDS = 300;

// PostgREST silently caps each response at the server's max_rows setting
// (1000 on Supabase by default). Page through the result set explicitly so
// the leaderboard never quietly drops data once the platform grows.
const FETCH_ALL_PAGE_SIZE = 1000;

type PagedQuery<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

async function fetchAll<T>(build: () => PagedQuery<T>): Promise<T[]> {
  const collected: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await build().range(
      from,
      from + FETCH_ALL_PAGE_SIZE - 1,
    );

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    collected.push(...rows);

    if (rows.length < FETCH_ALL_PAGE_SIZE) {
      break;
    }

    from += FETCH_ALL_PAGE_SIZE;
  }

  return collected;
}

// ---- main loader ----------------------------------------------------------

const EMPTY_RESULT: LeaderboardsResult = {
  creators: { all: [], month: [] },
  projects: { all: [], month: [] },
};

async function loadLeaderboardData(): Promise<LeaderboardData> {
  const supabase = createPublicReadOnlyClient();

  if (!supabase) {
    return { result: EMPTY_RESULT, creatorRatings: {}, projectRatings: {} };
  }

  // Per-project and per-profile aggregates are computed in Postgres by the
  // leaderboard_*_stats views, so we fetch O(projects) + O(profiles) compact
  // rows instead of every vote / media / skill / section row.
  const [projectStats, profileStats] = await Promise.all([
    fetchAll<ProjectStatsRow>(
      () =>
        supabase
          .from("leaderboard_project_stats")
          .select("*") as unknown as PagedQuery<ProjectStatsRow>,
    ),
    fetchAll<ProfileStatsRow>(
      () =>
        supabase
          .from("leaderboard_profile_stats")
          .select("*") as unknown as PagedQuery<ProfileStatsRow>,
    ),
  ]);

  // index: profile by user_id
  const profileByUserId = new Map(profileStats.map((p) => [p.user_id, p]));

  // index: profile.id -> user_id (used when awarding badges from rank lists)
  const userIdByProfileId = new Map(profileStats.map((p) => [p.id, p.user_id]));

  // index: project.id -> owner user_id (used to award project_of_the_month)
  const ownerIdByProjectId = new Map(
    projectStats.map((p) => [p.id, p.owner_id]),
  );

  // badge counts per user — feeds the rating bonus capped at +5
  const badgeCounts = await getBadgeCountsForUsers(
    supabase,
    profileStats.map((p) => p.user_id),
  );

  // track completeness per profile so we can award `complete_profile` after
  // ranking finishes (without recomputing inside the award loop).
  const completenessByProfileId = new Map<string, number>();

  // index: projects by owner
  const projectsByOwner = new Map<string, ProjectStatsRow[]>();
  for (const p of projectStats) {
    const arr = projectsByOwner.get(p.owner_id) || [];
    arr.push(p);
    projectsByOwner.set(p.owner_id, arr);
  }

  // ---- score all projects per timeframe -----------------------------------

  const projectRatingsMap = {
    all: new Map<string, number>(),
    month: new Map<string, number>(),
  };
  const rankedProjects: Record<LeaderboardTimeframe, RankedProject[]> = {
    all: [],
    month: [],
  };

  for (const tf of ["all", "month"] as const) {
    for (const project of projectStats) {
      if (!project.slug) continue;

      const mediaCount = project.media_count;
      const recentMediaCount = project.recent_media_count;
      const techCount = project.tech_count;

      const projectKindMetadata = project.kind_metadata;
      const projectKind = project.kind;
      const hasKindMetadata =
        projectKind != null &&
        projectKindMetadata != null &&
        typeof projectKindMetadata === "object" &&
        !Array.isArray(projectKindMetadata) &&
        Object.prototype.hasOwnProperty.call(projectKindMetadata, projectKind);

      const completeness = getProjectCompletenessScore({
        description: project.description,
        role: project.role,
        status: project.project_status,
        teamSize: project.team_size,
        projectUrl: project.project_url,
        repositoryUrl: project.repository_url,
        startedOn: project.started_on,
        completedOn: project.completed_on,
        problem: project.problem,
        solution: project.solution,
        results: project.results,
        coverUrl: project.cover_url,
        mediaCount,
        technologyCount: techCount,
        hasKindMetadata,
        kind: projectKind ?? null,
      });

      const rating = calculateProjectRating({
        timeframe: tf,
        likes: project.likes,
        dislikes: project.dislikes,
        recentLikes: project.recent_likes,
        recentDislikes: project.recent_dislikes,
        mediaCount,
        recentMediaCount,
        technologyCount: techCount,
        completenessScore: completeness,
        createdAt: project.created_at,
      });

      projectRatingsMap[tf].set(project.id, rating);
      const owner = profileByUserId.get(project.owner_id);

      rankedProjects[tf].push({
        id: project.id,
        title: project.title,
        slug: project.slug,
        description: project.description,
        cover_url: project.cover_url,
        ownerName: owner?.name ?? null,
        ownerUsername: owner?.username ?? null,
        rating,
        likes: project.likes,
        dislikes: project.dislikes,
        monthlyLikes: project.recent_likes,
        monthlyDislikes: project.recent_dislikes,
        mediaCount,
        technologyCount: techCount,
        coAuthorNames: [],
      });
    }

    rankedProjects[tf].sort(
      (a, b) =>
        b.rating - a.rating ||
        (tf === "month"
          ? b.monthlyLikes - a.monthlyLikes
          : b.likes - a.likes),
    );
  }

  // Attach co-author display names (owner excluded) to ranked projects. One
  // batch query over the displayed ids — does not touch the rating math above.
  const rankedProjectIds = Array.from(
    new Set(
      [...rankedProjects.all, ...rankedProjects.month].map((p) => p.id),
    ),
  );
  const projectCoAuthors = await loadAcceptedCoAuthorsMap(
    supabase,
    "project",
    rankedProjectIds,
  );
  for (const tf of ["all", "month"] as const) {
    for (const p of rankedProjects[tf]) {
      p.coAuthorNames = (projectCoAuthors.get(p.id) ?? [])
        .map((a) => a.name || a.username || "")
        .filter(Boolean);
    }
  }

  // ---- score all creators per timeframe -----------------------------------

  const rankedCreators: Record<LeaderboardTimeframe, RankedCreator[]> = {
    all: [],
    month: [],
  };

  for (const tf of ["all", "month"] as const) {
    for (const profile of profileStats) {
      if (!profile.username) continue;

      const owned = projectsByOwner.get(profile.user_id) || [];
      const ownedIds = owned.map((p) => p.id);

      // project ratings for this owner
      const ratings = ownedIds
        .map((id) => projectRatingsMap[tf].get(id) || 0)
        .filter((v) => v > 0);
      const bestRating = Math.max(...ratings, 0);
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((s, v) => s + v, 0) / ratings.length
          : 0;

      // profile votes (aggregated in the view)
      const allPv = { likes: profile.profile_likes, dislikes: profile.profile_dislikes };
      const recentPv = {
        likes: profile.recent_profile_likes,
        dislikes: profile.recent_profile_dislikes,
      };

      // media across owned projects — sum of the per-project counts
      const mediaCount = owned.reduce((s, p) => s + (p.media_count || 0), 0);
      const recentMediaCount = owned.reduce(
        (s, p) => s + (p.recent_media_count || 0),
        0,
      );
      const recentProjectCount = owned.filter((p) =>
        isWithinTimeframe(p.created_at, "month"),
      ).length;

      // unified tech breadth (profile skills + owned project skills) — counted
      // in the view as unified_tech_count.
      const technologyCount = profile.unified_tech_count;

      // newest project date
      const newestProject = owned.reduce<string | null>((best, p) => {
        if (!p.created_at) return best;
        if (!best) return p.created_at;
        return p.created_at > best ? p.created_at : best;
      }, null);

      const completeness = getProfileCompletenessScore({
        username: profile.username,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        headline: profile.headline,
        bio: profile.bio,
        countryId: profile.country_id,
        city: profile.city,
        website: profile.website,
        github: profile.github,
        twitter: profile.twitter,
        linkedin: profile.linkedin,
        behance: profile.behance,
        dribbble: profile.dribbble,
        artstation: profile.artstation,
        vimeo: profile.vimeo,
        youtube: profile.youtube,
        instagram: profile.instagram,
        contactEmail: profile.contact_email,
        telegramUsername: profile.telegram_username,
        phone: profile.phone,
        preferredContactMethod: profile.preferred_contact_method,
        experienceLevel: profile.experience_level,
        experienceYears: profile.experience_years,
        employmentTypesCount: profile.employment_types?.length || 0,
        workFormatsCount: profile.work_formats?.length || 0,
        salaryExpectations: profile.salary_expectations,
        salaryCurrency: profile.salary_currency,
        additionalInfo: profile.additional_info,
        skillsCount: profile.skills_count,
        languagesCount: profile.languages_count,
        educationCount: profile.education_count,
        certificateCount: profile.certificate_count,
        qaCount: profile.qa_count,
        workExperienceCount: profile.work_experience_count,
      });

      completenessByProfileId.set(profile.id, completeness);

      const rating = calculateUserRating({
        timeframe: tf,
        profileLikes: allPv.likes,
        profileDislikes: allPv.dislikes,
        recentProfileLikes: recentPv.likes,
        recentProfileDislikes: recentPv.dislikes,
        profileCompleteness: completeness,
        projectCount: owned.length,
        recentProjectCount,
        mediaCount,
        recentMediaCount,
        technologyCount,
        bestProjectRating: bestRating,
        averageProjectRating: avgRating,
        newestProjectCreatedAt: newestProject,
        badgeBonus: getBadgeBonusPoints(badgeCounts.get(profile.user_id) ?? 0),
      });

      const topProject = owned
        .map((p) => ({
          title: p.title,
          score: projectRatingsMap[tf].get(p.id) || 0,
        }))
        .sort((a, b) => b.score - a.score)[0];

      rankedCreators[tf].push({
        id: profile.id,
        username: profile.username,
        name: profile.name,
        avatar_url: profile.avatar_url,
        headline: profile.headline,
        rating,
        profileCompleteness: Math.round(completeness * 100),
        profileLikes: allPv.likes,
        profileDislikes: allPv.dislikes,
        projectCount: owned.length,
        topProjectTitle: topProject?.title || null,
        topProjectScore: topProject?.score || 0,
      });
    }

    rankedCreators[tf].sort(
      (a, b) =>
        b.rating - a.rating ||
        b.topProjectScore - a.topProjectScore ||
        b.projectCount - a.projectCount,
    );
  }

  // Award derived badges that depend on results computed above:
  //   complete_profile      (profile-completeness threshold)
  //   rising_star           (rank within current month top-50)
  //   top_100_all_time      (rank within all-time top-100)
  //   hall_of_fame          (rank within all-time top-10)
  //   top_10_monthly        (rank within current month top-10)
  //   project_of_the_month  (#1 project in the monthly ranking)
  //
  // Recognition badges are GATED: a rank is only meaningful once enough peers
  // actually compete for it (RECOGNITION_MIN_POOL) and the recipient has a real
  // score (rating > 0). Below the pool floor we award nothing, so a tiny early
  // user base doesn't hand every recognition badge to everyone.
  //
  // Writes need service-role privileges since RLS blocks anon writes.
  const adminClient = createAdminClient();
  if (adminClient) {
    const awards: Array<Promise<unknown>> = [];

    for (const [profileId, completeness] of completenessByProfileId) {
      if (completeness < COMPLETE_PROFILE_BADGE_THRESHOLD) continue;
      const userId = userIdByProfileId.get(profileId);
      if (!userId) continue;
      awards.push(awardBadgeByKey(adminClient, userId, "complete_profile"));
    }

    // Competitive pool sizes — only creators/projects with a real rating count.
    const allPool = rankedCreators.all.filter((c) => c.rating > 0).length;
    const monthPool = rankedCreators.month.filter((c) => c.rating > 0).length;
    const monthProjectPool = rankedProjects.month.filter(
      (p) => p.rating > 0,
    ).length;

    // Award the top `take` ranked creators a recognition badge, but only when
    // the pool clears `minPool` and each recipient's own rating is > 0.
    const awardRankedCreators = (
      list: RankedCreator[],
      take: number,
      pool: number,
      minPool: number,
      key: BadgeKey,
    ) => {
      if (pool < minPool) return;
      for (const entry of list.slice(0, take)) {
        if (entry.rating <= 0) continue;
        const userId = userIdByProfileId.get(entry.id);
        if (!userId) continue;
        awards.push(awardBadgeByKey(adminClient, userId, key));
      }
    };

    awardRankedCreators(
      rankedCreators.all,
      TOP_100_THRESHOLD,
      allPool,
      RECOGNITION_MIN_POOL.top_100_all_time,
      "top_100_all_time",
    );
    awardRankedCreators(
      rankedCreators.all,
      TOP_10_THRESHOLD,
      allPool,
      RECOGNITION_MIN_POOL.hall_of_fame,
      "hall_of_fame",
    );
    awardRankedCreators(
      rankedCreators.month,
      TOP_10_THRESHOLD,
      monthPool,
      RECOGNITION_MIN_POOL.top_10_monthly,
      "top_10_monthly",
    );
    awardRankedCreators(
      rankedCreators.month,
      RISING_STAR_MONTHLY_THRESHOLD,
      monthPool,
      RECOGNITION_MIN_POOL.rising_star,
      "rising_star",
    );

    // project_of_the_month — owner of the #1 monthly project, gated the same way.
    if (monthProjectPool >= RECOGNITION_MIN_POOL.project_of_the_month) {
      const topProject = rankedProjects.month[0];
      if (topProject && topProject.rating > 0) {
        const ownerId = ownerIdByProjectId.get(topProject.id);
        if (ownerId) {
          awards.push(
            awardBadgeByKey(adminClient, ownerId, "project_of_the_month"),
          );
        }
      }
    }

    // Run all awards in parallel. Errors are already swallowed inside
    // awardBadgeByKey — they must not block the leaderboard response.
    await Promise.all(awards);
  }

  // Full all-time rating map (every ranked creator, not just the top 10) so
  // other surfaces can look up the same composite rating by profile id.
  const creatorRatings: Record<string, number> = {};
  for (const creator of rankedCreators.all) {
    creatorRatings[creator.id] = creator.rating;
  }

  // Full all-time project rating map (every scored project) so other surfaces
  // can look up the same composite rating by project id.
  const projectRatings: Record<string, number> = {};
  for (const [projectId, rating] of projectRatingsMap.all) {
    projectRatings[projectId] = rating;
  }

  return {
    result: {
      creators: {
        all: rankedCreators.all.slice(0, 10),
        month: rankedCreators.month.slice(0, 10),
      },
      projects: {
        all: rankedProjects.all.slice(0, 10),
        month: rankedProjects.month.slice(0, 10),
      },
    },
    creatorRatings,
    projectRatings,
  };
}

// Cached entry point. The leaderboard reads only public data, so we use the
// anon read-only client (cookies are not allowed inside `unstable_cache`).
// Mutations invalidate the cache via `revalidateTag(LEADERBOARDS_CACHE_TAG)`.
const getLeaderboardData = unstable_cache(
  loadLeaderboardData,
  ["leaderboards-v2"],
  {
    revalidate: LEADERBOARDS_CACHE_REVALIDATE_SECONDS,
    tags: [LEADERBOARDS_CACHE_TAG],
  },
);

export async function getLeaderboards(): Promise<LeaderboardsResult> {
  return (await getLeaderboardData()).result;
}

// All-time composite creator rating (0-100) keyed by profile id — the same
// number shown on the homepage leaderboard. Shares the leaderboard cache, so
// callers pay nothing extra beyond the first computation per revalidate window.
export async function getCreatorRatings(): Promise<Record<string, number>> {
  return (await getLeaderboardData()).creatorRatings;
}

// All-time composite project rating (0-100) keyed by project id — the same
// number shown on the homepage leaderboard and the /projects search. Shares the
// leaderboard cache, so callers pay nothing beyond the first computation per
// revalidate window.
export async function getProjectRatings(): Promise<Record<string, number>> {
  return (await getLeaderboardData()).projectRatings;
}
