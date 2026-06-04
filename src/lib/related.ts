/**
 * Discovery helpers for "related / similar" recommendations.
 *
 * Items are ranked purely by how many skills (technologies) they share with
 * the item the visitor is currently viewing. Ties break on a quality signal
 * (score) and then recency, so equally-related items surface the strongest,
 * freshest work first.
 *
 * The query layer (`src/lib/db`) fetches candidate rows from Postgres; the
 * ranking math lives here as pure, framework-free functions so it can be
 * unit-tested without a database. The shapes are deliberately generic so the
 * same logic powers both related projects and related creators.
 */

/** Default number of recommendations rendered in a related section. */
export const RELATED_ITEMS_LIMIT = 6;

/** A join row linking an entity (project / profile) to a single skill. */
export type SkillLink = {
  entityId: string;
  skillId: number;
};

/**
 * Count how many of the reference skills each candidate entity shares.
 *
 * Rows referencing `excludeEntityId` are ignored so an item never recommends
 * itself, and only links whose skill is in `referenceSkillIds` are counted.
 * The result maps `entityId -> shared skill count` for every entity that
 * shares at least one skill.
 */
export function tallySharedSkills(
  links: SkillLink[],
  referenceSkillIds: Iterable<number>,
  excludeEntityId: string,
): Map<string, number> {
  const reference = new Set(referenceSkillIds);
  const counts = new Map<string, number>();

  if (reference.size === 0) {
    return counts;
  }

  for (const link of links) {
    if (link.entityId === excludeEntityId) {
      continue;
    }
    if (!reference.has(link.skillId)) {
      continue;
    }
    counts.set(link.entityId, (counts.get(link.entityId) || 0) + 1);
  }

  return counts;
}

/** A candidate ready to be ranked into a related list. */
export type RankableCandidate = {
  id: string;
  sharedSkillCount: number;
  /** Quality tiebreaker — e.g. the stored project score. */
  score: number;
  /** Recency tiebreaker as an ISO timestamp; nulls sort last. */
  createdAt: string | null;
};

/**
 * Rank candidates by shared-skill overlap, breaking ties on score then
 * recency. Candidates with zero overlap are dropped (a recommendation must be
 * genuinely related), and at most `limit` items are returned.
 */
export function rankBySharedSkills<T extends RankableCandidate>(
  candidates: T[],
  limit: number,
): T[] {
  if (limit <= 0) {
    return [];
  }

  return candidates
    .filter((candidate) => candidate.sharedSkillCount > 0)
    .sort(
      (a, b) =>
        b.sharedSkillCount - a.sharedSkillCount ||
        b.score - a.score ||
        compareRecencyDesc(a.createdAt, b.createdAt),
    )
    .slice(0, limit);
}

/** A creator candidate ready to be ranked into a related list. */
export type CreatorRankInput = {
  id: string;
  sharedSkillCount: number;
  /** Whether the creator sits in the same profile category as the reference. */
  sameCategory: boolean;
  /** Recency tiebreaker as an ISO timestamp; nulls sort last. */
  createdAt: string | null;
};

/**
 * Rank related creators. Unlike projects, a creator qualifies if they share a
 * skill OR sit in the same category — category is a strong relatedness signal
 * on this platform (e.g. "Frontend Developer"), and creators often list fewer
 * skills than projects do. Ordering: shared-skill overlap first, then
 * same-category, then recency. Creators with no overlap and a different
 * category are dropped. Returns at most `limit`.
 */
export function rankRelatedCreators<T extends CreatorRankInput>(
  candidates: T[],
  limit: number,
): T[] {
  if (limit <= 0) {
    return [];
  }

  return candidates
    .filter(
      (candidate) => candidate.sharedSkillCount > 0 || candidate.sameCategory,
    )
    .sort(
      (a, b) =>
        b.sharedSkillCount - a.sharedSkillCount ||
        Number(b.sameCategory) - Number(a.sameCategory) ||
        compareRecencyDesc(a.createdAt, b.createdAt),
    )
    .slice(0, limit);
}

/** Newest first; unparseable or missing dates sort to the end. */
function compareRecencyDesc(a: string | null, b: string | null): number {
  return toEpoch(b) - toEpoch(a);
}

function toEpoch(value: string | null): number {
  if (!value) {
    return 0;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}
