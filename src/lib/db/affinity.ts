import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildWeightMap,
  emptyAffinity,
  SIGNAL_WEIGHTS,
  type ViewerAffinity,
} from "@/lib/personalization";

/**
 * Loads the behavioural signals behind the "for you" ordering.
 *
 * Everything read here is already recorded by the product — bookmarks, votes,
 * follows, per-user project views, and the visitor's own profile and published
 * work. No new tracking is introduced, and nothing anonymous is profiled: an
 * unauthenticated visitor has no affinity and gets the impersonal ordering.
 *
 * Every individual signal is best-effort. A failing or RLS-blocked query
 * degrades that one signal to "absent" rather than failing the search, because
 * a discovery page that 500s is far worse than one ranked on partial evidence.
 */

/** Upper bound on rows pulled per signal, newest first. */
const SIGNAL_LIMIT = 200;
/** Upper bound on the projects we hydrate skills/kind for. */
const HYDRATE_LIMIT = 400;

type ProjectSignalRow = { id: string; kind: string | null; owner_id: string };

/**
 * Build the current viewer's affinity profile. Returns `null` for anonymous
 * visitors so callers can skip personalisation entirely.
 *
 * Memoised per request via React `cache()`: the discovery page and any
 * component that also needs the affinity share one load. The cache is
 * request-scoped, so one viewer's affinity can never leak into another's
 * response.
 */
export const loadViewerAffinity = cache(
  async (
    supabase: SupabaseClient,
    userId: string | null,
  ): Promise<ViewerAffinity | null> => {
    if (!userId) {
      return null;
    }

    const affinity = emptyAffinity(userId);

    // ---------------------------------------------------------------------
    // 1. Direct signals: own profile, own work, and explicit interactions.
    // ---------------------------------------------------------------------
    const [ownProfile, ownProjects, bookmarks, upvotes, follows, views] =
      await Promise.all([
        safe(
          () =>
            supabase
              .from("profiles")
              .select("id, category_id, country_id")
              .eq("user_id", userId)
              .maybeSingle(),
          null as { id: string; category_id: number | null; country_id: number | null } | null,
        ),
        safeList<ProjectSignalRow>(() =>
          supabase
            .from("projects")
            .select("id, kind, owner_id")
            .eq("owner_id", userId)
            .limit(SIGNAL_LIMIT),
        ),
        safeList<{ target_project_id: string | null; target_profile_id: string | null }>(
          () =>
            supabase
              .from("bookmarks")
              .select("target_project_id, target_profile_id")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(SIGNAL_LIMIT),
        ),
        safeList<{ project_id: string }>(() =>
          supabase
            .from("votes")
            .select("project_id")
            .eq("user_id", userId)
            .eq("value", 1)
            .limit(SIGNAL_LIMIT),
        ),
        safeList<{ following_user_id: string }>(() =>
          supabase
            .from("follows")
            .select("following_user_id")
            .eq("follower_user_id", userId)
            .order("created_at", { ascending: false })
            .limit(SIGNAL_LIMIT),
        ),
        loadViewedProjectIds(userId),
      ]);

    affinity.viewerProfileId = ownProfile?.id ?? null;
    affinity.countryId = ownProfile?.country_id ?? null;

    const ownProjectIds = ownProjects.map((row) => row.id);
    const bookmarkedProjectIds = bookmarks
      .map((row) => row.target_project_id)
      .filter((id): id is string => Boolean(id));
    const bookmarkedProfileIds = bookmarks
      .map((row) => row.target_profile_id)
      .filter((id): id is string => Boolean(id));
    const upvotedProjectIds = upvotes.map((row) => row.project_id).filter(Boolean);
    const followedUserIds = follows.map((row) => row.following_user_id).filter(Boolean);

    affinity.ownedProjectIds = new Set(ownProjectIds);
    affinity.followedUserIds = new Set(followedUserIds);
    affinity.seenProjectIds = new Set([
      ...ownProjectIds,
      ...bookmarkedProjectIds,
      ...upvotedProjectIds,
      ...views,
    ]);

    // ---------------------------------------------------------------------
    // 2. Hydrate what those interactions were *about* — the stack and format
    //    of every touched project, and the direction of every touched profile.
    // ---------------------------------------------------------------------
    const touchedProjectIds = [
      ...new Set([
        ...bookmarkedProjectIds,
        ...upvotedProjectIds,
        ...views,
        ...ownProjectIds,
      ]),
    ].slice(0, HYDRATE_LIMIT);

    const touchedProfileIds = [
      ...new Set([
        ...bookmarkedProfileIds,
        ...(affinity.viewerProfileId ? [affinity.viewerProfileId] : []),
      ]),
    ].slice(0, HYDRATE_LIMIT);

    const [
      ownProfileSkills,
      ownProfileLanguages,
      projectSkills,
      projectKinds,
      followedProfiles,
    ] = await Promise.all([
      affinity.viewerProfileId
        ? safeList<{ skill_id: number }>(() =>
            supabase
              .from("profile_skills")
              .select("skill_id")
              .eq("profile_id", affinity.viewerProfileId as string),
          )
        : Promise.resolve([]),
      affinity.viewerProfileId
        ? safeList<{ language_id: number | null }>(() =>
            supabase
              .from("profile_languages")
              .select("language_id")
              .eq("profile_id", affinity.viewerProfileId as string),
          )
        : Promise.resolve([]),
      touchedProjectIds.length > 0
        ? safeList<{ project_id: string; skill_id: number }>(() =>
            supabase
              .from("project_skills")
              .select("project_id, skill_id")
              .in("project_id", touchedProjectIds),
          )
        : Promise.resolve([]),
      touchedProjectIds.length > 0
        ? safeList<ProjectSignalRow>(() =>
            supabase
              .from("projects")
              .select("id, kind, owner_id")
              .in("id", touchedProjectIds),
          )
        : Promise.resolve([]),
      // Followed creators are keyed by auth user id; the profile ranker needs
      // profile ids, and their category is itself an interest signal.
      followedUserIds.length > 0 || touchedProfileIds.length > 0
        ? safeList<{ id: string; user_id: string; category_id: number | null }>(() =>
            supabase
              .from("profiles")
              .select("id, user_id, category_id")
              .or(
                [
                  followedUserIds.length > 0
                    ? `user_id.in.(${followedUserIds.join(",")})`
                    : null,
                  touchedProfileIds.length > 0
                    ? `id.in.(${touchedProfileIds.join(",")})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(","),
              ),
          )
        : Promise.resolve([]),
    ]);

    // ---------------------------------------------------------------------
    // 3. Fold everything into weighted interest maps.
    // ---------------------------------------------------------------------
    const skillsByProject = new Map<string, number[]>();
    for (const row of projectSkills) {
      const list = skillsByProject.get(row.project_id) ?? [];
      list.push(row.skill_id);
      skillsByProject.set(row.project_id, list);
    }

    const kindByProject = new Map<string, string | null>();
    for (const row of projectKinds) {
      kindByProject.set(row.id, row.kind);
    }

    const followedSet = new Set(followedUserIds);
    const bookmarkedProfileSet = new Set(bookmarkedProfileIds);
    const followedProfileIds = new Set<string>();
    const categorySignals: Array<{ keys: number[]; weight: number }> = [];

    for (const profile of followedProfiles) {
      if (followedSet.has(profile.user_id)) {
        followedProfileIds.add(profile.id);
        if (profile.category_id) {
          categorySignals.push({
            keys: [profile.category_id],
            weight: SIGNAL_WEIGHTS.follow,
          });
        }
      }

      if (bookmarkedProfileSet.has(profile.id) && profile.category_id) {
        categorySignals.push({
          keys: [profile.category_id],
          weight: SIGNAL_WEIGHTS.bookmark,
        });
      }
    }

    if (ownProfile?.category_id) {
      categorySignals.push({
        keys: [ownProfile.category_id],
        weight: SIGNAL_WEIGHTS.ownProfileSkill,
      });
    }

    affinity.followedProfileIds = followedProfileIds;

    const skillSignals: Array<{ keys: number[]; weight: number }> = [
      {
        keys: ownProfileSkills.map((row) => row.skill_id),
        weight: SIGNAL_WEIGHTS.ownProfileSkill,
      },
    ];
    const kindSignals: Array<{ keys: string[]; weight: number }> = [];

    const addProjectSignal = (projectId: string, weight: number) => {
      const skills = skillsByProject.get(projectId);
      if (skills?.length) {
        skillSignals.push({ keys: skills, weight });
      }
      const kind = kindByProject.get(projectId);
      if (kind) {
        kindSignals.push({ keys: [kind], weight });
      }
    };

    for (const id of ownProjectIds) {
      addProjectSignal(id, SIGNAL_WEIGHTS.ownProjectSkill);
    }
    for (const id of bookmarkedProjectIds) {
      addProjectSignal(id, SIGNAL_WEIGHTS.bookmark);
    }
    for (const id of upvotedProjectIds) {
      addProjectSignal(id, SIGNAL_WEIGHTS.upvote);
    }
    for (const id of views) {
      addProjectSignal(id, SIGNAL_WEIGHTS.view);
    }

    affinity.skillWeights = buildWeightMap(skillSignals);
    affinity.kindWeights = buildWeightMap(kindSignals);
    affinity.categoryWeights = buildWeightMap(categorySignals);
    affinity.languageIds = new Set(
      ownProfileLanguages
        .map((row) => row.language_id)
        .filter((id): id is number => typeof id === "number"),
    );

    // Own profile skills count once; every interaction counts individually.
    affinity.signalStrength =
      (ownProfileSkills.length > 0 ? 1 : 0) +
      ownProjectIds.length +
      bookmarkedProjectIds.length +
      bookmarkedProfileIds.length +
      upvotedProjectIds.length +
      followedUserIds.length +
      views.length;

    return affinity;
  },
);

/**
 * Per-user project views live behind RLS with no policies — only the
 * SECURITY DEFINER recorder writes them, and nothing may read them with a user
 * token (see `database/2026-07-20-project-views.sql`). Reading the viewer's own
 * rows therefore needs the service role. When the service key is not
 * configured this signal is simply absent, and the remaining signals carry the
 * ranking.
 */
async function loadViewedProjectIds(userId: string): Promise<string[]> {
  const admin = createAdminClient();

  if (!admin) {
    return [];
  }

  return (
    await safeList<{ project_id: string }>(() =>
      admin
        .from("project_views")
        .select("project_id")
        .eq("viewer_id", userId)
        .order("created_at", { ascending: false })
        .limit(SIGNAL_LIMIT),
    )
  ).map((row) => row.project_id);
}

type QueryResult<T> = { data: T | null; error: unknown };

async function safe<T>(
  run: () => PromiseLike<QueryResult<T>>,
  fallback: T,
): Promise<T> {
  try {
    const { data, error } = await run();
    return error || data == null ? fallback : data;
  } catch {
    return fallback;
  }
}

async function safeList<T>(run: () => PromiseLike<QueryResult<T[]>>): Promise<T[]> {
  return safe(run, [] as T[]);
}
