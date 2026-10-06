import {
  LEADERBOARD_DISPLAY_SIZE,
  TOP_CREATOR_MIN_COMPLETENESS_PERCENT,
  TOP_CREATOR_MIN_PUBLISHED_PROJECTS,
  TOP_PROJECTS_MAX_PER_OWNER,
} from "@/lib/constants/visibility";

/**
 * Which of the ranked rows the public leaderboards actually show. The ranking
 * itself (ratings, badges, the rating maps other pages read) is untouched —
 * these rules only decide what earns a place on a list meant to be social
 * proof, so it never shows blank profiles, one author ten times over, or
 * content that would be caught by moderation today.
 */

type EligibleCreator = {
  projectCount: number;
  profileCompleteness: number;
};

type DisplayProject = {
  id: string;
  title: string;
  description: string | null;
  ownerUsername: string | null;
};

export function isTopCreatorEligible(creator: EligibleCreator): boolean {
  return (
    creator.projectCount >= TOP_CREATOR_MIN_PUBLISHED_PROJECTS &&
    creator.profileCompleteness >= TOP_CREATOR_MIN_COMPLETENESS_PERCENT
  );
}

/** Ranked creators in order, keeping only those who earned a public place. */
export function selectTopCreators<T extends EligibleCreator>(
  ranked: readonly T[],
  size: number = LEADERBOARD_DISPLAY_SIZE,
): T[] {
  return ranked.filter(isTopCreatorEligible).slice(0, size);
}

/**
 * Ranked projects, capped per author first so the top of the board shows
 * different people (blocklisted ones are taken out before the ranking is
 * stored: blocklisted_project_ids in loadLeaderboardData). When there are too few authors to fill
 * the board that way, the free places go to their next-best projects in rank
 * order: a full list of two authors reads better than "top 10" with four rows.
 * Projects without an owner username are capped on their own id, so a missing
 * profile never lets many anonymous rows through as one "author".
 */
export function selectTopProjects<T extends DisplayProject>(
  ranked: readonly T[],
  size: number = LEADERBOARD_DISPLAY_SIZE,
  maxPerOwner: number = TOP_PROJECTS_MAX_PER_OWNER,
): T[] {
  const perOwner = new Map<string, number>();
  const selected: T[] = [];
  const overflow: T[] = [];

  for (const project of ranked) {
    if (selected.length >= size) break;

    const ownerKey = project.ownerUsername ?? `project:${project.id}`;
    const taken = perOwner.get(ownerKey) ?? 0;
    if (taken >= maxPerOwner) {
      overflow.push(project);
      continue;
    }

    perOwner.set(ownerKey, taken + 1);
    selected.push(project);
  }

  for (const project of overflow) {
    if (selected.length >= size) break;
    selected.push(project);
  }

  return selected;
}

/**
 * Newest portfolios first — what the home block shows while too few creators
 * qualify for a ranking. Anyone with published work counts; completeness is
 * not required, because this list promises freshness, not quality.
 * `latestProjectAt` is the newest project that passes the blocklist, so a
 * creator whose only work would be hidden from the boards is left out too.
 */
export function selectFreshCreators<
  T extends { projectCount: number; latestProjectAt?: string | null },
>(creators: readonly T[], size: number = LEADERBOARD_DISPLAY_SIZE): T[] {
  return creators
    .filter(
      (creator) =>
        creator.projectCount >= TOP_CREATOR_MIN_PUBLISHED_PROJECTS &&
        Boolean(creator.latestProjectAt),
    )
    .slice()
    .sort((a, b) =>
      (b.latestProjectAt || "").localeCompare(a.latestProjectAt || ""),
    )
    .slice(0, size);
}
