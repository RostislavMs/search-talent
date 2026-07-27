/**
 * The "related projects" recommender.
 *
 * The previous version ranked purely on *how many* technology tags two
 * projects had in common, which has three failure modes this replaces:
 *
 *  - Every tag counted the same, so sharing "Figma" (on hundreds of projects)
 *    outweighed nothing and sharing "Rust" (on three) counted no more. Popular
 *    tags dominated and the section filled with only loosely-related work.
 *    Overlap is now IDF-weighted: a rare shared technology is strong evidence,
 *    a ubiquitous one is weak.
 *  - Only tag overlap was considered. Format (a photo set is more like another
 *    photo set), quality, freshness and — for signed-in visitors — what the
 *    viewer actually engages with, now all contribute.
 *  - Anything with zero overlap was dropped, so a project with no tags, or
 *    with only unique ones, showed an empty section. Ranking now falls through
 *    tiers (overlap → same format → strong recent work) so there is always
 *    something to explore.
 *
 * Pure and framework-free so the weights are unit-testable without a database;
 * `getRelatedProjects` in `src/lib/db/public.ts` supplies the rows.
 */

import {
  hasUsableAffinity,
  scoreProjectAffinity,
  type ViewerAffinity,
} from "@/lib/personalization";
import { freshnessFactor, scoreFactor } from "@/lib/search-ranking";

/** At most this many projects by the same creator in one related section. */
export const MAX_PER_AUTHOR = 2;

/** How much of the final score personalisation may move, for signed-in users. */
const PERSONAL_WEIGHT = 0.25;

export type RelatedReference = {
  id: string;
  ownerUserId: string;
  kind: string | null;
  skillIds: number[];
};

export type RelatedCandidate = {
  id: string;
  ownerUserId: string;
  kind: string | null;
  skillIds: number[];
  score: number | null;
  createdAt: string | null;
  hasCover: boolean;
  mediaCount: number;
};

/**
 * Inverse document frequency per skill: how much signal a shared tag carries.
 *
 * `projectCounts` maps a skill id to the number of public projects using it
 * (the `skill_directory_stats` view). Unknown skills are treated as rare,
 * which is the safe default — a tag we have no count for is far more likely to
 * be niche than ubiquitous.
 */
export function buildSkillIdf(
  projectCounts: Map<number, number>,
  totalProjects: number,
): (skillId: number) => number {
  const total = Math.max(1, totalProjects);
  const ceiling = Math.log(1 + total);

  return (skillId: number) => {
    const documentFrequency = projectCounts.get(skillId) ?? 1;
    const idf = Math.log(1 + total / (1 + documentFrequency));
    return ceiling > 0 ? Math.min(1, idf / ceiling) : 0;
  };
}

/**
 * IDF-weighted cosine similarity between two tag sets, 0..1.
 *
 * Cosine (rather than a raw weighted count) keeps a project tagged with
 * twenty technologies from outranking a tightly-focused one just for having
 * more chances to overlap.
 */
export function stackSimilarity(
  referenceSkillIds: number[],
  candidateSkillIds: number[],
  idf: (skillId: number) => number,
): number {
  if (referenceSkillIds.length === 0 || candidateSkillIds.length === 0) {
    return 0;
  }

  const reference = new Set(referenceSkillIds);
  const candidate = new Set(candidateSkillIds);

  let shared = 0;
  for (const skillId of candidate) {
    if (reference.has(skillId)) {
      const weight = idf(skillId);
      shared += weight * weight;
    }
  }

  if (shared === 0) {
    return 0;
  }

  const referenceNorm = norm(reference, idf);
  const candidateNorm = norm(candidate, idf);

  if (referenceNorm === 0 || candidateNorm === 0) {
    return 0;
  }

  return Math.min(1, shared / (referenceNorm * candidateNorm));
}

function norm(skillIds: Set<number>, idf: (skillId: number) => number): number {
  let sum = 0;
  for (const skillId of skillIds) {
    const weight = idf(skillId);
    sum += weight * weight;
  }
  return Math.sqrt(sum);
}

/**
 * Which evidence put a candidate in the list. Used to fill the section in
 * tiers so a weak-but-real match never displaces a strong one, and so the
 * section is only padded once genuine matches run out.
 */
export type RelatedTier = "stack" | "kind" | "quality";

export type ScoredRelated<T> = {
  item: T;
  candidate: RelatedCandidate;
  tier: RelatedTier;
  score: number;
  similarity: number;
};

export type RelatedScoringContext = {
  idf: (skillId: number) => number;
  nowMs: number;
  /** Signed-in viewer's behavioural profile; null for anonymous visitors. */
  affinity?: ViewerAffinity | null;
};

/**
 * Score one candidate against the project being viewed.
 *
 * The impersonal blend leads: stack similarity dominates, format and quality
 * refine. For a signed-in visitor a bounded personal term rides on top, so the
 * ordering shifts toward what they engage with without ever overwhelming
 * genuine topical relatedness — "similar projects" that are not similar would
 * be a bug, not personalisation.
 */
export function scoreRelatedCandidate(
  candidate: RelatedCandidate,
  reference: RelatedReference,
  context: RelatedScoringContext,
): { score: number; similarity: number; tier: RelatedTier } {
  const similarity = stackSimilarity(
    reference.skillIds,
    candidate.skillIds,
    context.idf,
  );
  const sameKind =
    candidate.kind !== null && candidate.kind === reference.kind ? 1 : 0;
  const sameAuthor = candidate.ownerUserId === reference.ownerUserId ? 1 : 0;

  const quality =
    0.55 * scoreFactor(candidate.score) +
    0.25 * freshnessFactor(candidate.createdAt, context.nowMs) +
    0.2 *
      (0.5 * (candidate.hasCover ? 1 : 0) +
        0.5 * Math.min(1, candidate.mediaCount / 3));

  const impersonal =
    0.55 * similarity + 0.16 * sameKind + 0.05 * sameAuthor + 0.24 * quality;

  const affinity = hasUsableAffinity(context.affinity)
    ? scoreProjectAffinity(
        {
          id: candidate.id,
          ownerUserId: candidate.ownerUserId,
          kind: candidate.kind,
          skillIds: candidate.skillIds,
        },
        context.affinity,
      )
    : null;

  const score =
    affinity === null
      ? impersonal
      : (1 - PERSONAL_WEIGHT) * impersonal + PERSONAL_WEIGHT * affinity;

  const tier: RelatedTier =
    similarity > 0 ? "stack" : sameKind === 1 ? "kind" : "quality";

  return { score, similarity, tier };
}

const TIER_ORDER: RelatedTier[] = ["stack", "kind", "quality"];

/**
 * Rank and select the related list.
 *
 * Selection walks the tiers in order, so a project sharing a rare technology
 * always beats one that merely has the same format, which in turn beats a
 * generic strong project used as padding. Within a tier, no creator may take
 * more than `MAX_PER_AUTHOR` slots — without that cap a prolific author fills
 * the whole section and the visitor sees one portfolio instead of the field.
 * The cap is relaxed only if the tiers cannot otherwise fill `limit`.
 */
export function selectRelated<T>(
  candidates: Array<{ item: T; candidate: RelatedCandidate }>,
  reference: RelatedReference,
  context: RelatedScoringContext,
  limit: number,
): Array<ScoredRelated<T>> {
  if (limit <= 0) {
    return [];
  }

  const scored: Array<ScoredRelated<T>> = candidates
    .filter(({ candidate }) => candidate.id !== reference.id)
    .map(({ item, candidate }) => {
      const { score, similarity, tier } = scoreRelatedCandidate(
        candidate,
        reference,
        context,
      );
      return { item, candidate, tier, score, similarity };
    })
    .sort((left, right) => right.score - left.score);

  const selected: Array<ScoredRelated<T>> = [];
  const chosen = new Set<string>();
  const perAuthor = new Map<string, number>();

  for (const tier of TIER_ORDER) {
    for (const entry of scored) {
      if (selected.length >= limit) {
        return selected;
      }
      if (entry.tier !== tier || chosen.has(entry.candidate.id)) {
        continue;
      }

      const authorCount = perAuthor.get(entry.candidate.ownerUserId) ?? 0;
      if (authorCount >= MAX_PER_AUTHOR) {
        continue;
      }

      selected.push(entry);
      chosen.add(entry.candidate.id);
      perAuthor.set(entry.candidate.ownerUserId, authorCount + 1);
    }
  }

  // Still short: the author cap is a diversity preference, not a hard rule —
  // an under-filled section is worse than two extra projects by one creator.
  if (selected.length < limit) {
    for (const entry of scored) {
      if (selected.length >= limit) {
        break;
      }
      if (!chosen.has(entry.candidate.id)) {
        selected.push(entry);
        chosen.add(entry.candidate.id);
      }
    }
  }

  return selected;
}

/**
 * Order the reference project's technologies so the most discriminative come
 * first. Candidate discovery is bounded, so when the budget runs out it must
 * run out on the tag that says least about the project ("Figma"), never on the
 * one that says most ("Rust").
 */
export function orderSkillsByRarity(
  skillIds: number[],
  projectCounts: Map<number, number>,
): number[] {
  return [...new Set(skillIds)].sort(
    (left, right) =>
      (projectCounts.get(left) ?? 0) - (projectCounts.get(right) ?? 0) ||
      left - right,
  );
}
