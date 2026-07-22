/**
 * Pure discovery-ranking helpers extracted from `src/lib/db/search.ts` so they
 * can be unit-tested without the server-only DB module. `searchDiscovery`
 * imports these; behavior must stay identical to the previous inline versions.
 */

export type DiscoverySort = "relevance" | "rating" | "newest";

export function matchesQuery(value: string | null | undefined, query: string): boolean {
  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(query);
}

export interface ProjectRelevanceInput {
  title: string;
  description: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  technologies: string[];
}

export function getProjectRelevanceScore(project: ProjectRelevanceInput, query: string): number {
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

export interface ProfileRelevanceInput {
  username: string;
  name: string | null;
  headline: string | null;
  technologies: string[];
  countryName: string | null;
}

export function getProfileRelevanceScore(profile: ProfileRelevanceInput, query: string): number {
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

type RankedItem = {
  relevance: number;
  score: number | null;
  created_at: string | null;
};

type RankedProfile = RankedItem & {
  name: string | null;
  username: string;
};

/**
 * Descending comparator for projects. relevance-first for the "relevance" sort,
 * composite-rating-first for "rating", recency for "newest"; ties break on the
 * other numeric signal.
 */
export function projectComparator<T extends RankedItem>(
  sort: DiscoverySort,
): (left: T, right: T) => number {
  switch (sort) {
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
 * "relevance" sort adds an alphabetical (name → username) final tiebreak so the
 * order is stable.
 */
export function profileComparator<T extends RankedProfile>(
  sort: DiscoverySort,
): (left: T, right: T) => number {
  switch (sort) {
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
        (left.name || left.username).localeCompare(right.name || right.username);
  }
}
