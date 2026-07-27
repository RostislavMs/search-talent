/**
 * Pure discovery-ranking helpers used by `src/lib/db/search.ts` so they can be
 * unit-tested without the server-only DB module.
 *
 * Relevance is a genuine text-match score, not a proxy for the rating: it
 * tokenises the query, matches each token per field at word-aware tiers
 * (exact field > whole word > word prefix > loose substring), rewards covering
 * *all* query terms, and folds in how many of the visitor's selected facets the
 * row actually satisfies. A small 0..1 quality blend rides along as the final
 * term — enough to break ties when the text scores are equal, and (when there
 * is no query and no facets at all) enough to make the default "relevance"
 * ordering a freshness- and richness-aware "best overall" list rather than a
 * byte-identical duplicate of the "rating" sort, which is what it used to be.
 *
 * The personalised "for you" ordering lives in `src/lib/personalization.ts`;
 * this module only supplies the impersonal signals it blends with.
 */

export type DiscoverySort = "forYou" | "relevance" | "rating" | "newest";

/** Sort values a client may send; anything else falls back to "relevance". */
const SORT_VALUES: readonly DiscoverySort[] = [
  "forYou",
  "relevance",
  "rating",
  "newest",
];

export function normalizeSort(raw: string | null | undefined): DiscoverySort {
  return SORT_VALUES.includes(raw as DiscoverySort)
    ? (raw as DiscoverySort)
    : "relevance";
}

/**
 * Kept for the legacy loose-contains behaviour some callers still rely on.
 * The scorers below use the tiered matcher instead.
 */
export function matchesQuery(
  value: string | null | undefined,
  query: string,
): boolean {
  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(query);
}

// ---------------------------------------------------------------------------
// Tokenisation + tiered field matching
// ---------------------------------------------------------------------------

/**
 * Split a raw query into distinct lower-cased terms. Unicode-aware so
 * Ukrainian queries tokenise the same way Latin ones do; terms shorter than
 * two characters are dropped because they match almost everything.
 */
export function tokenizeQuery(query: string): string[] {
  if (!query) {
    return [];
  }

  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}+#.]+/u)
    .map((term) => term.replace(/^[.]+|[.]+$/g, ""))
    .filter((term) => term.length >= 2);

  return [...new Set(terms)];
}

/**
 * How well a single term matches one field, as a 0..1 multiplier.
 *
 * The tiers matter because plain `includes()` treats "react" hitting
 * "reactive programming" exactly like it hitting "React" — which is how a
 * search for a technology used to surface unrelated prose.
 */
export function matchTier(
  value: string | null | undefined,
  term: string,
): number {
  if (!value || !term) {
    return 0;
  }

  const haystack = value.toLowerCase();

  if (haystack === term) {
    return 1;
  }

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Whole word: bounded by a non-letter/digit on both sides.
  if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(haystack)) {
    return 0.8;
  }

  // Word prefix: "type" matching "typescript", but not "prototype".
  if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "u").test(haystack)) {
    return 0.55;
  }

  return haystack.includes(term) ? 0.3 : 0;
}

/** Best tier any of the values reaches for this term (used for tag lists). */
function bestTier(values: string[], term: string): number {
  let best = 0;

  for (const value of values) {
    const tier = matchTier(value, term);
    if (tier > best) {
      best = tier;
      if (best === 1) {
        break;
      }
    }
  }

  return best;
}

/**
 * Long prose dilutes a match: a term buried in a 900-character description is
 * weaker evidence than the same term in a 40-character one. Saturating so the
 * penalty never fully cancels the match.
 */
function lengthNormalizer(value: string | null | undefined): number {
  const length = value?.length ?? 0;
  return 200 / (200 + Math.max(0, length - 200));
}

// ---------------------------------------------------------------------------
// Quality blend (the 0..1 tail of every relevance score)
// ---------------------------------------------------------------------------

/** Half-life, in days, of the freshness component. */
const FRESHNESS_HALF_LIFE_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 0..1, 1 for something published right now, 0.5 after one half-life. */
export function freshnessFactor(
  createdAt: string | null | undefined,
  nowMs: number,
): number {
  if (!createdAt) {
    return 0;
  }

  const created = Date.parse(createdAt);

  if (Number.isNaN(created)) {
    return 0;
  }

  const ageDays = Math.max(0, (nowMs - created) / DAY_MS);
  return 2 ** (-ageDays / FRESHNESS_HALF_LIFE_DAYS);
}

/**
 * Saturating 0..1 map of the composite rating. Deliberately flat at the top so
 * a 20-point rating gap between two strong entries cannot outweigh a large
 * freshness or completeness gap.
 */
export function scoreFactor(score: number | null | undefined): number {
  const value = Math.max(0, score ?? 0);
  return value / (value + 50);
}

export type QualityInput = {
  score: number | null;
  createdAt: string | null;
  /** 0..1 — how complete / media-rich the entry is. */
  richness: number;
};

/**
 * The 0..1 impersonal quality blend. Weighted so freshness and richness can
 * genuinely reorder near-equal ratings — otherwise the default sort collapses
 * back into "order by score desc".
 */
export function qualityBlend(input: QualityInput, nowMs: number): number {
  return (
    0.6 * scoreFactor(input.score) +
    0.25 * freshnessFactor(input.createdAt, nowMs) +
    0.15 * Math.min(1, Math.max(0, input.richness))
  );
}

/** 0..1 richness for a project: cover, gallery media and a real write-up. */
export function projectRichness(input: {
  hasCover: boolean;
  mediaCount: number;
  descriptionLength: number;
  technologyCount: number;
}): number {
  return (
    0.3 * (input.hasCover ? 1 : 0) +
    0.3 * Math.min(1, input.mediaCount / 4) +
    0.2 * Math.min(1, input.descriptionLength / 400) +
    0.2 * Math.min(1, input.technologyCount / 5)
  );
}

/** 0..1 richness for a profile: avatar, headline and a filled-in skill list. */
export function profileRichness(input: {
  hasAvatar: boolean;
  headlineLength: number;
  technologyCount: number;
  hasLocation: boolean;
}): number {
  return (
    0.35 * (input.hasAvatar ? 1 : 0) +
    0.25 * Math.min(1, input.headlineLength / 80) +
    0.25 * Math.min(1, input.technologyCount / 5) +
    0.15 * (input.hasLocation ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Facet relevance
// ---------------------------------------------------------------------------

/**
 * Selected facets are part of what the visitor asked for, so satisfying more
 * of them is more relevant. Previously a project matching all three selected
 * skills ranked level with one matching a single skill, because the facets
 * only filtered and never scored.
 */
export function facetRelevance(input: {
  selectedSkillIds: number[];
  entitySkillIds: number[];
}): number {
  const selected = input.selectedSkillIds;

  if (selected.length === 0) {
    return 0;
  }

  const owned = new Set(input.entitySkillIds);
  const matched = selected.filter((id) => owned.has(id)).length;

  return FACET_WEIGHT * (matched / selected.length);
}

const FACET_WEIGHT = 6;

// ---------------------------------------------------------------------------
// Project relevance
// ---------------------------------------------------------------------------

export interface ProjectRelevanceInput {
  title: string;
  description: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  technologies: string[];
}

const PROJECT_FIELD_WEIGHTS = {
  title: 10,
  technologies: 6,
  description: 3.5,
  owner: 2.5,
} as const;

/**
 * Text relevance of a project for a query. Zero when the query is empty — the
 * caller adds the facet and quality terms on top (see `composeRelevance`).
 */
export function getProjectRelevanceScore(
  project: ProjectRelevanceInput,
  query: string,
): number {
  const terms = tokenizeQuery(query);

  if (terms.length === 0) {
    return 0;
  }

  const descriptionNorm = lengthNormalizer(project.description);
  let total = 0;
  let covered = 0;

  for (const term of terms) {
    const title = matchTier(project.title, term);
    const technologies = bestTier(project.technologies, term);
    const description = matchTier(project.description, term) * descriptionNorm;
    const owner = Math.max(
      matchTier(project.ownerName, term),
      matchTier(project.ownerUsername, term),
    );

    total +=
      PROJECT_FIELD_WEIGHTS.title * title +
      PROJECT_FIELD_WEIGHTS.technologies * technologies +
      PROJECT_FIELD_WEIGHTS.description * description +
      PROJECT_FIELD_WEIGHTS.owner * owner;

    if (title > 0 || technologies > 0 || description > 0 || owner > 0) {
      covered += 1;
    }
  }

  return applyCoverage(total, covered, terms.length);
}

// ---------------------------------------------------------------------------
// Profile relevance
// ---------------------------------------------------------------------------

export interface ProfileRelevanceInput {
  username: string;
  name: string | null;
  headline: string | null;
  technologies: string[];
  countryName: string | null;
}

const PROFILE_FIELD_WEIGHTS = {
  name: 9,
  username: 8,
  technologies: 6,
  headline: 4,
  country: 2,
} as const;

/** Text relevance of a creator profile for a query. Zero for an empty query. */
export function getProfileRelevanceScore(
  profile: ProfileRelevanceInput,
  query: string,
): number {
  const terms = tokenizeQuery(query);

  if (terms.length === 0) {
    return 0;
  }

  const headlineNorm = lengthNormalizer(profile.headline);
  let total = 0;
  let covered = 0;

  for (const term of terms) {
    const name = matchTier(profile.name, term);
    const username = matchTier(profile.username, term);
    const technologies = bestTier(profile.technologies, term);
    const headline = matchTier(profile.headline, term) * headlineNorm;
    const country = matchTier(profile.countryName, term);

    total +=
      PROFILE_FIELD_WEIGHTS.name * name +
      PROFILE_FIELD_WEIGHTS.username * username +
      PROFILE_FIELD_WEIGHTS.technologies * technologies +
      PROFILE_FIELD_WEIGHTS.headline * headline +
      PROFILE_FIELD_WEIGHTS.country * country;

    if (name > 0 || username > 0 || technologies > 0 || headline > 0 || country > 0) {
      covered += 1;
    }
  }

  return applyCoverage(total, covered, terms.length);
}

/**
 * Averages the per-term score and rewards matching every term. A row hitting
 * both words of "react portfolio" should beat one hitting "react" twice as
 * hard but missing "portfolio" entirely.
 */
function applyCoverage(total: number, covered: number, termCount: number): number {
  if (termCount === 0) {
    return 0;
  }

  const coverage = covered / termCount;
  return (total / termCount) * (0.4 + 0.6 * coverage) * (1 + 0.35 * coverage);
}

/**
 * The value stored on each row as `relevance`: text match + facet satisfaction
 * + the 0..1 quality tail. With no query and no facets this reduces to the
 * quality blend alone, which is what makes the default listing a curated
 * "best overall" order instead of a second rating sort.
 */
export function composeRelevance(input: {
  text: number;
  facet: number;
  quality: number;
}): number {
  return input.text + input.facet + input.quality;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Only 12/24/48 are valid page sizes; anything else falls back to 12.
 */
export function normalizePerPage(raw: number | null | undefined): number {
  return [12, 24, 48].includes(raw ?? 0) ? (raw as number) : 12;
}

/**
 * Page is 1-based; non-positive / missing values fall back to page 1.
 */
export function normalizePage(raw: number | null | undefined): number {
  return raw && raw > 0 ? raw : 1;
}

export function pageOffset(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

type RankedItem = {
  relevance: number;
  score: number | null;
  created_at: string | null;
  /** Personal affinity for the current viewer; 0 when not personalised. */
  personal?: number;
};

type RankedProfile = RankedItem & {
  name: string | null;
  username: string;
};

/**
 * Descending comparator for projects. "forYou" leads with the personal
 * affinity blend, "relevance" with the composed relevance, "rating" with the
 * composite score and "newest" with recency; each falls through to the next
 * signal so the order is total and stable.
 */
export function projectComparator<T extends RankedItem>(
  sort: DiscoverySort,
): (left: T, right: T) => number {
  switch (sort) {
    case "forYou":
      return (left, right) =>
        (right.personal ?? 0) - (left.personal ?? 0) ||
        right.relevance - left.relevance ||
        (right.score ?? 0) - (left.score ?? 0);
    case "rating":
      return (left, right) =>
        (right.score ?? 0) - (left.score ?? 0) || right.relevance - left.relevance;
    case "newest":
      return (left, right) =>
        new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
    default:
      return (left, right) =>
        right.relevance - left.relevance || (right.score ?? 0) - (left.score ?? 0);
  }
}

/**
 * Descending comparator for profiles. Mirrors `projectComparator` but the
 * relevance-led sorts add an alphabetical (name → username) final tiebreak so
 * the order is stable.
 */
export function profileComparator<T extends RankedProfile>(
  sort: DiscoverySort,
): (left: T, right: T) => number {
  const alphabetical = (left: T, right: T) =>
    (left.name || left.username).localeCompare(right.name || right.username);

  switch (sort) {
    case "forYou":
      return (left, right) =>
        (right.personal ?? 0) - (left.personal ?? 0) ||
        right.relevance - left.relevance ||
        (right.score ?? 0) - (left.score ?? 0) ||
        alphabetical(left, right);
    case "rating":
      return (left, right) =>
        (right.score ?? 0) - (left.score ?? 0) || right.relevance - left.relevance;
    case "newest":
      return (left, right) =>
        new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
    default:
      return (left, right) =>
        right.relevance - left.relevance ||
        (right.score ?? 0) - (left.score ?? 0) ||
        alphabetical(left, right);
  }
}
