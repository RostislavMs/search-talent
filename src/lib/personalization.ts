/**
 * Viewer-affinity scoring — the "for you" half of discovery ranking.
 *
 * Discovery used to be entirely impersonal: two visitors with opposite
 * interests saw byte-identical listings, because nothing about who was looking
 * ever reached the ranker. This module turns the behaviour the platform
 * already records — what a visitor bookmarked, voted on, opened, who they
 * follow, and the stack on their own profile and projects — into a 0..1
 * affinity per row, which `src/lib/db/search.ts` and the related-projects
 * recommender blend with the impersonal quality and text signals.
 *
 * Everything here is pure. Loading the raw signals is `src/lib/db/affinity.ts`;
 * keeping the maths framework-free means the weights can be unit-tested
 * without a database.
 */

/**
 * How much each kind of interaction says about what someone likes. Explicit
 * acts (bookmarking, listing a skill on your own profile) outrank incidental
 * ones (opening a page once).
 */
export const SIGNAL_WEIGHTS = {
  /** Skills the visitor lists on their own profile. */
  ownProfileSkill: 3,
  /** Stack of projects the visitor published themselves. */
  ownProjectSkill: 2.5,
  /** Explicitly saved for later — the strongest interest signal we record. */
  bookmark: 2.5,
  /** Upvoted a project. */
  upvote: 2,
  /** Follows the creator. */
  follow: 1.5,
  /** Opened the project page (deduped per user by `project_views`). */
  view: 1,
} as const;

/** A batch of skill ids observed through one kind of interaction. */
export type AffinitySignal = {
  skillIds: number[];
  weight: number;
};

/**
 * Collapse raw signals into a `skillId -> 0..1` interest map, normalised
 * against the strongest skill so the scale never depends on how active the
 * visitor is. A brand-new user with two signals and a power user with two
 * hundred both end up with a top skill of 1.
 */
export function buildWeightMap<K>(
  signals: Array<{ keys: K[]; weight: number }>,
): Map<K, number> {
  const totals = new Map<K, number>();

  for (const signal of signals) {
    if (signal.weight <= 0) {
      continue;
    }

    for (const key of new Set(signal.keys)) {
      totals.set(key, (totals.get(key) ?? 0) + signal.weight);
    }
  }

  let max = 0;
  for (const value of totals.values()) {
    if (value > max) {
      max = value;
    }
  }

  if (max <= 0) {
    return new Map();
  }

  const normalized = new Map<K, number>();
  for (const [key, value] of totals) {
    normalized.set(key, value / max);
  }

  return normalized;
}

/** Everything the ranker knows about the current viewer. */
export type ViewerAffinity = {
  viewerUserId: string;
  viewerProfileId: string | null;
  /** skillId -> 0..1 interest. */
  skillWeights: Map<number, number>;
  /** profile category id -> 0..1 interest. */
  categoryWeights: Map<number, number>;
  /** project kind ("design", "code", …) -> 0..1 interest. */
  kindWeights: Map<string, number>;
  /** auth user ids of creators the viewer follows. */
  followedUserIds: Set<string>;
  /** profile ids of creators the viewer follows. */
  followedProfileIds: Set<string>;
  /** Projects the viewer already opened, bookmarked or owns. */
  seenProjectIds: Set<string>;
  /** Projects the viewer published. */
  ownedProjectIds: Set<string>;
  countryId: number | null;
  languageIds: Set<number>;
  /**
   * Count of distinct interactions behind the maps above. Personalisation is
   * only applied past `MIN_SIGNAL_STRENGTH`; below it the affinity is noise
   * and the impersonal order is the better default.
   */
  signalStrength: number;
};

/**
 * Below this many recorded interactions the affinity maps are too sparse to
 * rank on — a single opened project would otherwise dictate a whole listing.
 */
export const MIN_SIGNAL_STRENGTH = 3;

export function hasUsableAffinity(
  affinity: ViewerAffinity | null | undefined,
): affinity is ViewerAffinity {
  return Boolean(affinity && affinity.signalStrength >= MIN_SIGNAL_STRENGTH);
}

/** An empty affinity, used for anonymous visitors. */
export function emptyAffinity(
  viewerUserId = "",
  viewerProfileId: string | null = null,
): ViewerAffinity {
  return {
    viewerUserId,
    viewerProfileId,
    skillWeights: new Map(),
    categoryWeights: new Map(),
    kindWeights: new Map(),
    followedUserIds: new Set(),
    followedProfileIds: new Set(),
    seenProjectIds: new Set(),
    ownedProjectIds: new Set(),
    countryId: null,
    languageIds: new Set(),
    signalStrength: 0,
  };
}

/**
 * Interest in a set of skills, saturating so that matching four of the
 * viewer's technologies is only modestly better than matching three — we want
 * breadth of overlap to matter, not to let one heavily-tagged project run away
 * with the ranking.
 */
function skillOverlap(
  skillIds: Iterable<number>,
  skillWeights: Map<number, number>,
): number {
  if (skillWeights.size === 0) {
    return 0;
  }

  let sum = 0;
  for (const id of skillIds) {
    sum += skillWeights.get(id) ?? 0;
  }

  // 2.0 ≈ two top-interest skills matched, which already counts as a strong
  // match; beyond that the curve flattens.
  return Math.min(1, sum / 2);
}

export type ProjectAffinityInput = {
  id: string;
  ownerUserId: string;
  kind: string | null;
  skillIds: number[];
};

/**
 * 0..1 affinity of a project for the viewer.
 *
 * Positive: stack overlap, the format they usually browse, and work by
 * creators they follow. Negative: their own projects and projects they have
 * already opened — discovery should surface new work, and an "already seen"
 * row occupying a slot is a wasted slot.
 */
export function scoreProjectAffinity(
  project: ProjectAffinityInput,
  affinity: ViewerAffinity,
): number {
  const skills = skillOverlap(project.skillIds, affinity.skillWeights);
  const kind = project.kind ? (affinity.kindWeights.get(project.kind) ?? 0) : 0;
  const author = affinity.followedUserIds.has(project.ownerUserId) ? 1 : 0;

  let score = 0.55 * skills + 0.17 * kind + 0.28 * author;

  if (affinity.ownedProjectIds.has(project.id)) {
    // You do not need your own work recommended back to you.
    score -= 0.5;
  } else if (affinity.seenProjectIds.has(project.id)) {
    score -= 0.25;
  }

  return clamp01(score);
}

export type ProfileAffinityInput = {
  profileId: string;
  userId: string | null;
  categoryId: number | null;
  countryId: number | null;
  skillIds: number[];
  languageIds: number[];
};

/**
 * 0..1 affinity of a creator profile for the viewer.
 *
 * Shared stack and direction lead. A creator the viewer already follows is
 * demoted rather than promoted: they are reachable from the following list,
 * so a discovery slot is better spent on someone new. The viewer's own profile
 * is pushed to the bottom outright.
 */
export function scoreProfileAffinity(
  profile: ProfileAffinityInput,
  affinity: ViewerAffinity,
): number {
  if (
    (affinity.viewerProfileId && profile.profileId === affinity.viewerProfileId) ||
    (profile.userId && profile.userId === affinity.viewerUserId)
  ) {
    return 0;
  }

  const skills = skillOverlap(profile.skillIds, affinity.skillWeights);
  const category = profile.categoryId
    ? (affinity.categoryWeights.get(profile.categoryId) ?? 0)
    : 0;
  const sameCountry =
    affinity.countryId !== null && profile.countryId === affinity.countryId ? 1 : 0;
  const sharedLanguage =
    affinity.languageIds.size > 0 &&
    profile.languageIds.some((id) => affinity.languageIds.has(id))
      ? 1
      : 0;

  let score =
    0.5 * skills + 0.24 * category + 0.14 * sameCountry + 0.12 * sharedLanguage;

  if (affinity.followedProfileIds.has(profile.profileId)) {
    score -= 0.3;
  }

  return clamp01(score);
}

/**
 * Blend affinity with the impersonal signals into the value the "for you"
 * sort orders on.
 *
 * With a query on screen the visitor has stated an intent, so text relevance
 * leads and affinity only re-orders within comparably-relevant rows — a search
 * for "Figma" must not return someone's favourite Rust project. With no query
 * there is no stated intent, and affinity leads.
 *
 * `relevanceNorm` and `quality` are both 0..1; the caller normalises relevance
 * against the strongest row in the current result set.
 */
export function personalScore(input: {
  affinity: number;
  quality: number;
  relevanceNorm: number;
  hasQuery: boolean;
}): number {
  if (input.hasQuery) {
    return (
      0.5 * clamp01(input.relevanceNorm) +
      0.32 * clamp01(input.affinity) +
      0.18 * clamp01(input.quality)
    );
  }

  return 0.62 * clamp01(input.affinity) + 0.38 * clamp01(input.quality);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
