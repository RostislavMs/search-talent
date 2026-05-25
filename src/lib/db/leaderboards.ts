import "server-only";

import { unstable_cache } from "next/cache";
import {
  awardBadgeByKey,
  getBadgeCountsForUsers,
} from "@/lib/db/badges";
import {
  COMPLETE_PROFILE_BADGE_THRESHOLD,
  TOP_10_THRESHOLD,
  TOP_100_THRESHOLD,
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
import { createAdminClient, createPublicReadOnlyClient } from "@/lib/supabase/admin";

// ---- row types ------------------------------------------------------------

type PublicProfileRow = {
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
};

type PublicProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string | null;
  description: string | null;
  role: string | null;
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
};

type VoteRow = { project_id: string; value: number; created_at: string | null };
type ProfileVoteRow = { profile_id: string; value: number; created_at: string | null };
type MediaRow = { project_id: string; created_at: string | null };
type ProjectSkillRow = { project_id: string; skill_id: number };
type ProfileRelationRow = { profile_id: string; skill_id?: number; language_id?: number };
type ProfileSectionRow = { profile_id: string };

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

async function fetchAllTolerant<T>(build: () => PagedQuery<T>): Promise<T[]> {
  try {
    return await fetchAll<T>(build);
  } catch {
    return [];
  }
}

function countVotes(
  rows: VoteRow[] | ProfileVoteRow[],
  timeframe: LeaderboardTimeframe,
) {
  return rows.reduce(
    (r, row) => {
      if (timeframe === "month" && !isWithinTimeframe(row.created_at, "month"))
        return r;
      if (row.value === 1) r.likes += 1;
      if (row.value === -1) r.dislikes += 1;
      return r;
    },
    { likes: 0, dislikes: 0 },
  );
}

function countByKey<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T & string,
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = String(row[key]);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

type ReadOnlyClient = NonNullable<ReturnType<typeof createPublicReadOnlyClient>>;

function trySelectSections(supabase: ReadOnlyClient, table: string) {
  return fetchAllTolerant<ProfileSectionRow>(
    () =>
      supabase.from(table).select("profile_id") as unknown as PagedQuery<
        ProfileSectionRow
      >,
  );
}

// ---- main loader ----------------------------------------------------------

const EMPTY_RESULT: LeaderboardsResult = {
  creators: { all: [], month: [] },
  projects: { all: [], month: [] },
};

async function loadLeaderboards(): Promise<LeaderboardsResult> {
  const supabase = createPublicReadOnlyClient();

  if (!supabase) {
    return EMPTY_RESULT;
  }

  const [
    profiles,
    projects,
    votes,
    media,
    projectSkills,
    profileSkills,
    profileLanguages,
    educationRows,
    certificateRows,
    qaRows,
    workExpRows,
    profileVotes,
  ] = await Promise.all([
    fetchAll<PublicProfileRow>(
      () =>
        supabase
          .from("profiles")
          .select(
            "id, user_id, username, name, avatar_url, headline, bio, country_id, city, website, github, twitter, linkedin, contact_email, telegram_username, phone, preferred_contact_method, experience_level, experience_years, employment_types, work_formats, salary_expectations, salary_currency, additional_info",
          )
          .not("username", "is", null) as unknown as PagedQuery<PublicProfileRow>,
    ),
    fetchAll<PublicProjectRow>(
      () =>
        supabase
          .from("projects")
          .select(
            "id, owner_id, title, slug, description, role, project_status, team_size, project_url, repository_url, started_on, completed_on, problem, solution, results, cover_url, created_at",
          )
          .eq("status", "published") as unknown as PagedQuery<PublicProjectRow>,
    ),
    fetchAll<VoteRow>(
      () =>
        supabase
          .from("votes")
          .select("project_id, value, created_at") as unknown as PagedQuery<VoteRow>,
    ),
    fetchAll<MediaRow>(
      () =>
        supabase
          .from("project_media")
          .select("project_id, created_at") as unknown as PagedQuery<MediaRow>,
    ),
    fetchAll<ProjectSkillRow>(
      () =>
        supabase
          .from("project_skills")
          .select("project_id, skill_id") as unknown as PagedQuery<ProjectSkillRow>,
    ),
    fetchAll<ProfileRelationRow>(
      () =>
        supabase
          .from("profile_skills")
          .select("profile_id, skill_id") as unknown as PagedQuery<ProfileRelationRow>,
    ),
    fetchAll<ProfileRelationRow>(
      () =>
        supabase
          .from("profile_languages")
          .select("profile_id, language_id") as unknown as PagedQuery<ProfileRelationRow>,
    ),
    trySelectSections(supabase, "profile_education"),
    trySelectSections(supabase, "profile_certificates"),
    trySelectSections(supabase, "profile_qas"),
    trySelectSections(supabase, "profile_work_experience"),
    fetchAllTolerant<ProfileVoteRow>(
      () =>
        supabase
          .from("profile_votes")
          .select("profile_id, value, created_at") as unknown as PagedQuery<ProfileVoteRow>,
    ),
  ]);

  // index: profile by user_id
  const profileByUserId = new Map(profiles.map((p) => [p.user_id, p]));

  // index: profile.id -> user_id (used when awarding badges from rank lists)
  const userIdByProfileId = new Map(profiles.map((p) => [p.id, p.user_id]));

  // badge counts per user — feeds the rating bonus capped at +5
  const badgeCounts = await getBadgeCountsForUsers(
    supabase,
    profiles.map((p) => p.user_id),
  );

  // track completeness per profile so we can award `complete_profile` after
  // ranking finishes (without recomputing inside the award loop).
  const completenessByProfileId = new Map<string, number>();

  // index: votes grouped by project
  const votesByProject = new Map<string, VoteRow[]>();
  for (const v of votes) {
    const arr = votesByProject.get(v.project_id) || [];
    arr.push(v);
    votesByProject.set(v.project_id, arr);
  }

  // index: media grouped by project
  const mediaByProject = new Map<string, MediaRow[]>();
  for (const m of media) {
    const arr = mediaByProject.get(m.project_id) || [];
    arr.push(m);
    mediaByProject.set(m.project_id, arr);
  }

  // index: skill sets
  const projectSkillSet = new Map<string, Set<number>>();
  for (const r of projectSkills) {
    const s = projectSkillSet.get(r.project_id) || new Set();
    s.add(r.skill_id);
    projectSkillSet.set(r.project_id, s);
  }

  const profileSkillSet = new Map<string, Set<number>>();
  for (const r of profileSkills) {
    if (typeof r.skill_id !== "number") continue;
    const s = profileSkillSet.get(r.profile_id) || new Set();
    s.add(r.skill_id);
    profileSkillSet.set(r.profile_id, s);
  }

  const profileLangSet = new Map<string, Set<number>>();
  for (const r of profileLanguages) {
    if (typeof r.language_id !== "number") continue;
    const s = profileLangSet.get(r.profile_id) || new Set();
    s.add(r.language_id);
    profileLangSet.set(r.profile_id, s);
  }

  // index: profile votes by profile
  const pvByProfile = new Map<string, ProfileVoteRow[]>();
  for (const v of profileVotes) {
    const arr = pvByProfile.get(v.profile_id) || [];
    arr.push(v);
    pvByProfile.set(v.profile_id, arr);
  }

  // index: profile section counts
  const eduCount = countByKey(educationRows, "profile_id");
  const certCount = countByKey(certificateRows, "profile_id");
  const qaCount = countByKey(qaRows, "profile_id");
  const weCount = countByKey(workExpRows, "profile_id");

  // index: projects by owner
  const projectsByOwner = new Map<string, PublicProjectRow[]>();
  for (const p of projects) {
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
    for (const project of projects) {
      if (!project.slug) continue;

      const pv = votesByProject.get(project.id) || [];
      const allVotes = countVotes(pv, "all");
      const recentVotes = countVotes(pv, "month");
      const mi = mediaByProject.get(project.id) || [];
      const mediaCount = mi.length;
      const recentMediaCount = mi.filter((m) =>
        isWithinTimeframe(m.created_at, "month"),
      ).length;
      const techCount = (projectSkillSet.get(project.id) || new Set()).size;

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
      });

      const rating = calculateProjectRating({
        timeframe: tf,
        likes: allVotes.likes,
        dislikes: allVotes.dislikes,
        recentLikes: recentVotes.likes,
        recentDislikes: recentVotes.dislikes,
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
        likes: allVotes.likes,
        dislikes: allVotes.dislikes,
        monthlyLikes: recentVotes.likes,
        monthlyDislikes: recentVotes.dislikes,
        mediaCount,
        technologyCount: techCount,
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

  // ---- score all creators per timeframe -----------------------------------

  const rankedCreators: Record<LeaderboardTimeframe, RankedCreator[]> = {
    all: [],
    month: [],
  };

  for (const tf of ["all", "month"] as const) {
    for (const profile of profiles) {
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

      // profile votes
      const pv = pvByProfile.get(profile.id) || [];
      const allPv = countVotes(pv, "all");
      const recentPv = countVotes(pv, "month");

      // media across owned projects
      const allMedia = ownedIds.flatMap(
        (id) => mediaByProject.get(id) || [],
      );
      const recentMediaCount = allMedia.filter((m) =>
        isWithinTimeframe(m.created_at, "month"),
      ).length;
      const recentProjectCount = owned.filter((p) =>
        isWithinTimeframe(p.created_at, "month"),
      ).length;

      // unified tech set (profile skills + project skills)
      const techIds = new Set<number>([
        ...Array.from(profileSkillSet.get(profile.id) || new Set<number>()),
        ...ownedIds.flatMap((id) =>
          Array.from(projectSkillSet.get(id) || new Set<number>()),
        ),
      ]);

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
        skillsCount: (profileSkillSet.get(profile.id) || new Set()).size,
        languagesCount: (profileLangSet.get(profile.id) || new Set()).size,
        educationCount: eduCount.get(profile.id) || 0,
        certificateCount: certCount.get(profile.id) || 0,
        qaCount: qaCount.get(profile.id) || 0,
        workExperienceCount: weCount.get(profile.id) || 0,
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
        mediaCount: allMedia.length,
        recentMediaCount,
        technologyCount: techIds.size,
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
  //   complete_profile  (profile-completeness threshold)
  //   top_100_all_time  (rank within all-time top-100)
  //   hall_of_fame      (rank within all-time top-10)
  //   top_10_monthly    (rank within current month top-10)
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

    for (const entry of rankedCreators.all.slice(0, TOP_100_THRESHOLD)) {
      const userId = userIdByProfileId.get(entry.id);
      if (!userId) continue;
      awards.push(awardBadgeByKey(adminClient, userId, "top_100_all_time"));
    }

    for (const entry of rankedCreators.all.slice(0, TOP_10_THRESHOLD)) {
      const userId = userIdByProfileId.get(entry.id);
      if (!userId) continue;
      awards.push(awardBadgeByKey(adminClient, userId, "hall_of_fame"));
    }

    for (const entry of rankedCreators.month.slice(0, TOP_10_THRESHOLD)) {
      const userId = userIdByProfileId.get(entry.id);
      if (!userId) continue;
      awards.push(awardBadgeByKey(adminClient, userId, "top_10_monthly"));
    }

    // Run all awards in parallel. Errors are already swallowed inside
    // awardBadgeByKey — they must not block the leaderboard response.
    await Promise.all(awards);
  }

  return {
    creators: {
      all: rankedCreators.all.slice(0, 10),
      month: rankedCreators.month.slice(0, 10),
    },
    projects: {
      all: rankedProjects.all.slice(0, 10),
      month: rankedProjects.month.slice(0, 10),
    },
  };
}

// Cached entry point. The leaderboard reads only public data, so we use the
// anon read-only client (cookies are not allowed inside `unstable_cache`).
// Mutations invalidate the cache via `revalidateTag(LEADERBOARDS_CACHE_TAG)`.
export const getLeaderboards = unstable_cache(
  loadLeaderboards,
  ["leaderboards-v1"],
  {
    revalidate: LEADERBOARDS_CACHE_REVALIDATE_SECONDS,
    tags: [LEADERBOARDS_CACHE_TAG],
  },
);
