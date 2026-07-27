import { describe, expect, it } from "vitest";
import {
  buildWeightMap,
  emptyAffinity,
  hasUsableAffinity,
  MIN_SIGNAL_STRENGTH,
  personalScore,
  scoreProfileAffinity,
  scoreProjectAffinity,
  type ViewerAffinity,
} from "@/lib/personalization";

function affinityWith(overrides: Partial<ViewerAffinity>): ViewerAffinity {
  return {
    ...emptyAffinity("viewer-1", "profile-1"),
    signalStrength: 10,
    ...overrides,
  };
}

describe("buildWeightMap", () => {
  it("normalises against the strongest key so the scale is activity-independent", () => {
    const light = buildWeightMap([
      { keys: [1], weight: 3 },
      { keys: [2], weight: 1 },
    ]);
    const heavy = buildWeightMap([
      { keys: [1], weight: 300 },
      { keys: [2], weight: 100 },
    ]);

    expect(light.get(1)).toBe(1);
    expect(light.get(2)).toBeCloseTo(1 / 3, 6);
    expect(heavy.get(1)).toBe(light.get(1));
    expect(heavy.get(2)).toBeCloseTo(light.get(2)!, 6);
  });

  it("accumulates repeated keys across signals", () => {
    const map = buildWeightMap([
      { keys: [1], weight: 1 },
      { keys: [1], weight: 1 },
      { keys: [2], weight: 1 },
    ]);
    expect(map.get(1)).toBe(1);
    expect(map.get(2)).toBe(0.5);
  });

  it("counts a key once per signal even if repeated within it", () => {
    const map = buildWeightMap([
      { keys: [1, 1, 1], weight: 1 },
      { keys: [2], weight: 1 },
    ]);
    expect(map.get(1)).toBe(map.get(2));
  });

  it("ignores non-positive weights and returns empty when there is nothing", () => {
    expect(buildWeightMap([{ keys: [1], weight: 0 }]).size).toBe(0);
    expect(buildWeightMap([]).size).toBe(0);
  });
});

describe("hasUsableAffinity", () => {
  it("rejects null, and anything below the signal threshold", () => {
    expect(hasUsableAffinity(null)).toBe(false);
    expect(hasUsableAffinity(undefined)).toBe(false);
    expect(
      hasUsableAffinity(affinityWith({ signalStrength: MIN_SIGNAL_STRENGTH - 1 })),
    ).toBe(false);
  });

  it("accepts an affinity at or above the threshold", () => {
    expect(
      hasUsableAffinity(affinityWith({ signalStrength: MIN_SIGNAL_STRENGTH })),
    ).toBe(true);
  });
});

describe("scoreProjectAffinity", () => {
  const project = {
    id: "p1",
    ownerUserId: "author-1",
    kind: "design",
    skillIds: [1, 2],
  };

  it("rewards overlap with the viewer's interest map", () => {
    const strong = scoreProjectAffinity(
      project,
      affinityWith({ skillWeights: new Map([[1, 1], [2, 1]]) }),
    );
    const weak = scoreProjectAffinity(
      project,
      affinityWith({ skillWeights: new Map([[1, 0.1]]) }),
    );
    const none = scoreProjectAffinity(project, affinityWith({}));

    expect(strong).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThan(none);
    expect(none).toBe(0);
  });

  it("rewards the format the viewer usually browses", () => {
    const matching = scoreProjectAffinity(
      project,
      affinityWith({ kindWeights: new Map([["design", 1]]) }),
    );
    const other = scoreProjectAffinity(
      project,
      affinityWith({ kindWeights: new Map([["code", 1]]) }),
    );
    expect(matching).toBeGreaterThan(other);
  });

  it("rewards work by a followed creator", () => {
    const followed = scoreProjectAffinity(
      project,
      affinityWith({ followedUserIds: new Set(["author-1"]) }),
    );
    expect(followed).toBeGreaterThan(scoreProjectAffinity(project, affinityWith({})));
  });

  it("demotes already-seen work, and demotes the viewer's own work harder", () => {
    const skills = new Map([[1, 1], [2, 1]]);
    const fresh = scoreProjectAffinity(project, affinityWith({ skillWeights: skills }));
    const seen = scoreProjectAffinity(
      project,
      affinityWith({ skillWeights: skills, seenProjectIds: new Set(["p1"]) }),
    );
    const own = scoreProjectAffinity(
      project,
      affinityWith({
        skillWeights: skills,
        seenProjectIds: new Set(["p1"]),
        ownedProjectIds: new Set(["p1"]),
      }),
    );

    expect(fresh).toBeGreaterThan(seen);
    expect(seen).toBeGreaterThan(own);
  });

  it("stays inside 0..1 even when every signal fires", () => {
    const score = scoreProjectAffinity(
      project,
      affinityWith({
        skillWeights: new Map([[1, 1], [2, 1]]),
        kindWeights: new Map([["design", 1]]),
        followedUserIds: new Set(["author-1"]),
      }),
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("scoreProfileAffinity", () => {
  const profile = {
    profileId: "other-profile",
    userId: "other-user",
    categoryId: 7,
    countryId: 804,
    skillIds: [1],
    languageIds: [1],
  };

  it("zeroes out the viewer's own profile, by profile id or user id", () => {
    expect(
      scoreProfileAffinity(
        { ...profile, profileId: "profile-1" },
        affinityWith({ skillWeights: new Map([[1, 1]]) }),
      ),
    ).toBe(0);
    expect(
      scoreProfileAffinity(
        { ...profile, userId: "viewer-1" },
        affinityWith({ skillWeights: new Map([[1, 1]]) }),
      ),
    ).toBe(0);
  });

  it("rewards shared stack, direction, country and language", () => {
    const base = scoreProfileAffinity(profile, affinityWith({}));
    const skills = scoreProfileAffinity(
      profile,
      affinityWith({ skillWeights: new Map([[1, 1]]) }),
    );
    const category = scoreProfileAffinity(
      profile,
      affinityWith({ categoryWeights: new Map([[7, 1]]) }),
    );
    const country = scoreProfileAffinity(profile, affinityWith({ countryId: 804 }));
    const language = scoreProfileAffinity(
      profile,
      affinityWith({ languageIds: new Set([1]) }),
    );

    expect(base).toBe(0);
    for (const score of [skills, category, country, language]) {
      expect(score).toBeGreaterThan(0);
    }
    expect(skills).toBeGreaterThan(category);
    expect(category).toBeGreaterThan(country);
  });

  it("demotes creators the viewer already follows", () => {
    const skills = new Map([[1, 1]]);
    const discoverable = scoreProfileAffinity(
      profile,
      affinityWith({ skillWeights: skills }),
    );
    const alreadyFollowed = scoreProfileAffinity(
      profile,
      affinityWith({
        skillWeights: skills,
        followedProfileIds: new Set(["other-profile"]),
      }),
    );
    expect(discoverable).toBeGreaterThan(alreadyFollowed);
  });
});

describe("personalScore", () => {
  it("lets text relevance lead once the visitor has typed a query", () => {
    const relevant = personalScore({
      affinity: 0,
      quality: 0,
      relevanceNorm: 1,
      hasQuery: true,
    });
    const merelyLiked = personalScore({
      affinity: 1,
      quality: 0,
      relevanceNorm: 0,
      hasQuery: true,
    });
    expect(relevant).toBeGreaterThan(merelyLiked);
  });

  it("lets affinity lead when there is no stated intent", () => {
    const liked = personalScore({
      affinity: 1,
      quality: 0,
      relevanceNorm: 0,
      hasQuery: false,
    });
    const merelyGood = personalScore({
      affinity: 0,
      quality: 1,
      relevanceNorm: 1,
      hasQuery: false,
    });
    expect(liked).toBeGreaterThan(merelyGood);
  });

  it("ignores relevance entirely with no query, since every row scores the same", () => {
    const a = personalScore({ affinity: 0.5, quality: 0.5, relevanceNorm: 0, hasQuery: false });
    const b = personalScore({ affinity: 0.5, quality: 0.5, relevanceNorm: 1, hasQuery: false });
    expect(a).toBe(b);
  });

  it("clamps its inputs and stays inside 0..1", () => {
    expect(
      personalScore({ affinity: 9, quality: 9, relevanceNorm: 9, hasQuery: true }),
    ).toBeLessThanOrEqual(1);
    expect(
      personalScore({ affinity: -9, quality: -9, relevanceNorm: -9, hasQuery: false }),
    ).toBe(0);
    expect(
      personalScore({ affinity: NaN, quality: 0.5, relevanceNorm: 0, hasQuery: false }),
    ).toBeCloseTo(0.19, 6);
  });
});
