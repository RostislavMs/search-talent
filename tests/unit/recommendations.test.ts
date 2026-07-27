import { describe, expect, it } from "vitest";
import { emptyAffinity, type ViewerAffinity } from "@/lib/personalization";
import {
  buildSkillIdf,
  MAX_PER_AUTHOR,
  orderSkillsByRarity,
  scoreRelatedCandidate,
  selectRelated,
  stackSimilarity,
  type RelatedCandidate,
  type RelatedReference,
} from "@/lib/recommendations";

const NOW = Date.parse("2026-07-27T00:00:00Z");
const daysAgo = (days: number) =>
  new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

// 1 is ubiquitous ("Figma"), 9 is niche ("Rust").
const COUNTS = new Map([
  [1, 500],
  [2, 400],
  [9, 3],
  [10, 4],
]);
const IDF = buildSkillIdf(COUNTS, 500);

function candidate(overrides: Partial<RelatedCandidate> = {}): RelatedCandidate {
  return {
    id: "c1",
    ownerUserId: "author-a",
    kind: "code",
    skillIds: [1],
    score: 40,
    createdAt: daysAgo(30),
    hasCover: true,
    mediaCount: 2,
    ...overrides,
  };
}

const reference: RelatedReference = {
  id: "ref",
  ownerUserId: "author-ref",
  kind: "code",
  skillIds: [1, 9],
};

describe("buildSkillIdf", () => {
  it("weights a rare technology above a ubiquitous one", () => {
    expect(IDF(9)).toBeGreaterThan(IDF(1));
  });

  it("treats an unknown skill as rare rather than as noise", () => {
    expect(IDF(9999)).toBeGreaterThan(IDF(1));
  });

  it("stays within 0..1 and survives a zero total", () => {
    expect(IDF(9)).toBeLessThanOrEqual(1);
    expect(IDF(1)).toBeGreaterThanOrEqual(0);
    expect(buildSkillIdf(new Map(), 0)(1)).toBeGreaterThanOrEqual(0);
  });
});

describe("stackSimilarity", () => {
  it("scores a shared rare technology above a shared common one", () => {
    const rare = stackSimilarity([1, 9], [9], IDF);
    const common = stackSimilarity([1, 9], [1], IDF);
    expect(rare).toBeGreaterThan(common);
  });

  it("is 0 with no overlap or an empty side", () => {
    expect(stackSimilarity([1], [2], IDF)).toBe(0);
    expect(stackSimilarity([], [1], IDF)).toBe(0);
    expect(stackSimilarity([1], [], IDF)).toBe(0);
  });

  it("does not reward tag-stuffing: a focused match beats a diluted one", () => {
    const focused = stackSimilarity([9, 10], [9, 10], IDF);
    const diluted = stackSimilarity([9, 10], [9, 10, 1, 2], IDF);
    expect(focused).toBeGreaterThan(diluted);
  });

  it("caps at 1 for an identical stack", () => {
    expect(stackSimilarity([1, 9], [1, 9], IDF)).toBeCloseTo(1, 6);
  });
});

describe("scoreRelatedCandidate", () => {
  const context = { idf: IDF, nowMs: NOW, affinity: null };

  it("labels the tier by the strongest evidence available", () => {
    expect(
      scoreRelatedCandidate(candidate({ skillIds: [9] }), reference, context).tier,
    ).toBe("stack");
    expect(
      scoreRelatedCandidate(
        candidate({ skillIds: [777], kind: "code" }),
        reference,
        context,
      ).tier,
    ).toBe("kind");
    expect(
      scoreRelatedCandidate(
        candidate({ skillIds: [777], kind: "photo" }),
        reference,
        context,
      ).tier,
    ).toBe("quality");
  });

  it("ranks a rare-tag match above a common-tag match", () => {
    const rare = scoreRelatedCandidate(candidate({ id: "r", skillIds: [9] }), reference, context);
    const common = scoreRelatedCandidate(candidate({ id: "c", skillIds: [1] }), reference, context);
    expect(rare.score).toBeGreaterThan(common.score);
  });

  it("prefers the fresher, better-presented project when stacks tie", () => {
    const good = scoreRelatedCandidate(
      candidate({ skillIds: [9], score: 80, createdAt: daysAgo(5), mediaCount: 4 }),
      reference,
      context,
    );
    const stale = scoreRelatedCandidate(
      candidate({
        skillIds: [9],
        score: 5,
        createdAt: daysAgo(1200),
        mediaCount: 0,
        hasCover: false,
      }),
      reference,
      context,
    );
    expect(good.score).toBeGreaterThan(stale.score);
  });

  it("keeps topical similarity ahead of personalisation", () => {
    // A project the viewer would love, but that shares nothing with what they
    // are looking at, must not outrank a genuine match. "Similar projects"
    // that are not similar is a bug, not personalisation.
    const affinity: ViewerAffinity = {
      ...emptyAffinity("viewer-1", "profile-1"),
      signalStrength: 50,
      skillWeights: new Map([[42, 1]]),
      kindWeights: new Map([["photo", 1]]),
    };
    const personalContext = { idf: IDF, nowMs: NOW, affinity };

    const topical = scoreRelatedCandidate(
      candidate({ id: "topical", skillIds: [9] }),
      reference,
      personalContext,
    );
    const beloved = scoreRelatedCandidate(
      candidate({ id: "beloved", skillIds: [42], kind: "photo" }),
      reference,
      personalContext,
    );

    expect(topical.score).toBeGreaterThan(beloved.score);
  });

  it("still lets affinity break a tie between equally similar projects", () => {
    const affinity: ViewerAffinity = {
      ...emptyAffinity("viewer-1", "profile-1"),
      signalStrength: 50,
      followedUserIds: new Set(["author-b"]),
    };
    const personalContext = { idf: IDF, nowMs: NOW, affinity };

    const followed = scoreRelatedCandidate(
      candidate({ id: "b", ownerUserId: "author-b", skillIds: [9] }),
      reference,
      personalContext,
    );
    const stranger = scoreRelatedCandidate(
      candidate({ id: "a", ownerUserId: "author-a", skillIds: [9] }),
      reference,
      personalContext,
    );

    expect(followed.score).toBeGreaterThan(stranger.score);
  });
});

describe("selectRelated", () => {
  const context = { idf: IDF, nowMs: NOW, affinity: null };
  const wrap = (candidates: RelatedCandidate[]) =>
    candidates.map((c) => ({ item: c.id, candidate: c }));

  it("never recommends the reference project back to itself", () => {
    const picked = selectRelated(
      wrap([candidate({ id: "ref", skillIds: [9] }), candidate({ id: "other", skillIds: [9] })]),
      reference,
      context,
      6,
    );
    expect(picked.map((p) => p.item)).toEqual(["other"]);
  });

  it("puts every genuine stack match ahead of format-only and padding rows", () => {
    const picked = selectRelated(
      wrap([
        candidate({ id: "pad", skillIds: [777], kind: "photo", score: 100 }),
        candidate({ id: "format", skillIds: [777], kind: "code", score: 100 }),
        candidate({ id: "stack", skillIds: [9], score: 1, createdAt: daysAgo(900) }),
      ]),
      reference,
      context,
      3,
    );
    expect(picked.map((p) => p.item)).toEqual(["stack", "format", "pad"]);
  });

  it("caps how many slots one creator can take", () => {
    const picked = selectRelated(
      wrap([
        candidate({ id: "a1", ownerUserId: "prolific", skillIds: [9] }),
        candidate({ id: "a2", ownerUserId: "prolific", skillIds: [9] }),
        candidate({ id: "a3", ownerUserId: "prolific", skillIds: [9] }),
        candidate({ id: "b1", ownerUserId: "other", skillIds: [9] }),
      ]),
      reference,
      context,
      3,
    );

    const prolific = picked.filter((p) => p.candidate.ownerUserId === "prolific");
    expect(prolific).toHaveLength(MAX_PER_AUTHOR);
    expect(picked.map((p) => p.item)).toContain("b1");
  });

  it("relaxes the author cap rather than returning a short list", () => {
    const picked = selectRelated(
      wrap([
        candidate({ id: "a1", ownerUserId: "solo", skillIds: [9] }),
        candidate({ id: "a2", ownerUserId: "solo", skillIds: [9] }),
        candidate({ id: "a3", ownerUserId: "solo", skillIds: [9] }),
      ]),
      reference,
      context,
      3,
    );
    expect(picked).toHaveLength(3);
  });

  it("still fills the section for a project with no technologies at all", () => {
    const picked = selectRelated(
      wrap([
        candidate({ id: "x", skillIds: [1], kind: "code" }),
        candidate({ id: "y", skillIds: [2], kind: "photo", ownerUserId: "author-b" }),
      ]),
      { ...reference, skillIds: [] },
      context,
      6,
    );
    expect(picked.map((p) => p.item).sort()).toEqual(["x", "y"]);
  });

  it("honours the limit and returns nothing for a non-positive one", () => {
    const pool = wrap([
      candidate({ id: "a", skillIds: [9] }),
      candidate({ id: "b", skillIds: [9], ownerUserId: "author-b" }),
      candidate({ id: "c", skillIds: [9], ownerUserId: "author-c" }),
    ]);
    expect(selectRelated(pool, reference, context, 2)).toHaveLength(2);
    expect(selectRelated(pool, reference, context, 0)).toEqual([]);
  });

  it("never emits the same project twice", () => {
    const picked = selectRelated(
      wrap([
        candidate({ id: "dup", skillIds: [9] }),
        candidate({ id: "dup", skillIds: [9] }),
      ]),
      reference,
      context,
      6,
    );
    expect(picked).toHaveLength(1);
  });
});

describe("orderSkillsByRarity", () => {
  it("puts the most discriminative technology first", () => {
    expect(orderSkillsByRarity([1, 9, 2], COUNTS)).toEqual([9, 2, 1]);
  });

  it("dedupes and treats unknown skills as rarest", () => {
    expect(orderSkillsByRarity([1, 1, 77], COUNTS)).toEqual([77, 1]);
  });

  it("is stable for equal counts", () => {
    expect(orderSkillsByRarity([30, 20, 10], new Map())).toEqual([10, 20, 30]);
  });
});
