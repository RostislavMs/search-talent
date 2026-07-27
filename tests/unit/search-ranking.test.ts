import { describe, expect, it } from "vitest";
import {
  composeRelevance,
  facetRelevance,
  freshnessFactor,
  getProfileRelevanceScore,
  getProjectRelevanceScore,
  matchesQuery,
  matchTier,
  normalizePage,
  normalizePerPage,
  normalizeSort,
  pageOffset,
  profileComparator,
  projectComparator,
  qualityBlend,
  scoreFactor,
  tokenizeQuery,
  type ProfileRelevanceInput,
  type ProjectRelevanceInput,
} from "@/lib/search-ranking";

// The search RPCs lower-case the query before scoring; tests pass lower-cased
// queries to mirror that contract.

describe("matchesQuery", () => {
  it("is case-insensitive substring match", () => {
    expect(matchesQuery("Hello World", "world")).toBe(true);
    expect(matchesQuery("Hello", "xyz")).toBe(false);
  });

  it("returns false for null/undefined/empty values", () => {
    expect(matchesQuery(null, "a")).toBe(false);
    expect(matchesQuery(undefined, "a")).toBe(false);
    expect(matchesQuery("", "a")).toBe(false);
  });
});

describe("tokenizeQuery", () => {
  it("splits on punctuation and whitespace, lower-cases and dedupes", () => {
    expect(tokenizeQuery("React, Next.js — REACT")).toEqual(["react", "next.js"]);
  });

  it("keeps technology punctuation that carries meaning", () => {
    expect(tokenizeQuery("c++ and c#")).toEqual(["c++", "and", "c#"]);
  });

  it("drops one-character noise and empty queries", () => {
    expect(tokenizeQuery("a react b")).toEqual(["react"]);
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("   ")).toEqual([]);
  });

  it("tokenizes Cyrillic the same way as Latin", () => {
    expect(tokenizeQuery("Дизайн інтерфейсів")).toEqual([
      "дизайн",
      "інтерфейсів",
    ]);
  });
});

describe("matchTier", () => {
  it("ranks exact field above whole word above prefix above loose substring", () => {
    const exact = matchTier("react", "react");
    const word = matchTier("built with react today", "react");
    const prefix = matchTier("reactive streams", "react");
    const loose = matchTier("prereact helper", "react");

    expect(exact).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(loose);
    expect(loose).toBeGreaterThan(0);
  });

  it("returns 0 when the term is absent or the value is empty", () => {
    expect(matchTier("react", "vue")).toBe(0);
    expect(matchTier(null, "react")).toBe(0);
    expect(matchTier("react", "")).toBe(0);
  });

  it("treats regex metacharacters in the term as literals", () => {
    expect(() => matchTier("c++ project", "c++")).not.toThrow();
    expect(matchTier("c++ project", "c++")).toBeGreaterThan(0);
    expect(matchTier("react", "r.act")).toBe(0);
  });
});

describe("getProjectRelevanceScore", () => {
  const base: ProjectRelevanceInput = {
    title: "Portfolio Builder",
    description: "A tool for creatives",
    ownerName: "Ada Lovelace",
    ownerUsername: "ada",
    technologies: ["React", "TypeScript"],
  };

  it("returns 0 for an empty query", () => {
    expect(getProjectRelevanceScore(base, "")).toBe(0);
  });

  it("scores an exact title match higher than a partial one", () => {
    const exact = getProjectRelevanceScore({ ...base, title: "react" }, "react");
    const partial = getProjectRelevanceScore(
      { ...base, title: "react native kit" },
      "react",
    );
    expect(exact).toBeGreaterThan(partial);
  });

  it("weights title above technologies above description above owner", () => {
    const only = (field: Partial<ProjectRelevanceInput>) =>
      getProjectRelevanceScore(
        {
          title: "untitled",
          description: null,
          ownerName: null,
          ownerUsername: null,
          technologies: [],
          ...field,
        },
        "kotlin",
      );

    const title = only({ title: "kotlin" });
    const tech = only({ technologies: ["Kotlin"] });
    const description = only({ description: "written in kotlin" });
    const owner = only({ ownerUsername: "kotlin" });

    expect(title).toBeGreaterThan(tech);
    expect(tech).toBeGreaterThan(description);
    expect(description).toBeGreaterThan(owner);
    expect(owner).toBeGreaterThan(0);
  });

  it("does not treat a substring hit as a whole-word hit", () => {
    const word = getProjectRelevanceScore(
      { ...base, title: "react toolkit", technologies: [] },
      "react",
    );
    const substring = getProjectRelevanceScore(
      { ...base, title: "prereactor toolkit", technologies: [] },
      "react",
    );
    expect(word).toBeGreaterThan(substring);
  });

  it("rewards covering every query term over hammering one of them", () => {
    const both = getProjectRelevanceScore(
      {
        ...base,
        title: "react portfolio",
        description: null,
        technologies: [],
      },
      "react portfolio",
    );
    const one = getProjectRelevanceScore(
      {
        ...base,
        title: "react react react",
        description: "react react",
        technologies: ["React"],
      },
      "react portfolio",
    );
    expect(both).toBeGreaterThan(one);
  });

  it("dilutes a match buried in a very long description", () => {
    const short = getProjectRelevanceScore(
      { ...base, title: "untitled", technologies: [], description: "uses kotlin" },
      "kotlin",
    );
    const long = getProjectRelevanceScore(
      {
        ...base,
        title: "untitled",
        technologies: [],
        description: `${"filler text ".repeat(200)}uses kotlin`,
      },
      "kotlin",
    );
    expect(short).toBeGreaterThan(long);
    expect(long).toBeGreaterThan(0);
  });
});

describe("getProfileRelevanceScore", () => {
  const base: ProfileRelevanceInput = {
    username: "ada",
    name: "Ada Lovelace",
    headline: "Systems thinker",
    technologies: ["Rust"],
    countryName: "Ukraine",
  };

  it("returns 0 for an empty query", () => {
    expect(getProfileRelevanceScore(base, "")).toBe(0);
  });

  it("scores an exact username match higher than a partial one", () => {
    const exact = getProfileRelevanceScore({ ...base, username: "rust" }, "rust");
    const partial = getProfileRelevanceScore(
      { ...base, username: "rustacean" },
      "rust",
    );
    expect(exact).toBeGreaterThan(partial);
  });

  it("weights name above headline above country", () => {
    expect(getProfileRelevanceScore(base, "lovelace")).toBeGreaterThan(
      getProfileRelevanceScore(base, "thinker"),
    );
    expect(getProfileRelevanceScore(base, "thinker")).toBeGreaterThan(
      getProfileRelevanceScore(base, "ukraine"),
    );
    expect(getProfileRelevanceScore(base, "ukraine")).toBeGreaterThan(0);
  });
});

describe("facetRelevance", () => {
  it("scales with how many selected facets the row satisfies", () => {
    const all = facetRelevance({ selectedSkillIds: [1, 2, 3], entitySkillIds: [1, 2, 3, 9] });
    const some = facetRelevance({ selectedSkillIds: [1, 2, 3], entitySkillIds: [1, 9] });

    expect(all).toBeGreaterThan(some);
    expect(some).toBeGreaterThan(0);
  });

  it("is zero when nothing is selected or nothing matches", () => {
    expect(facetRelevance({ selectedSkillIds: [], entitySkillIds: [1] })).toBe(0);
    expect(facetRelevance({ selectedSkillIds: [1], entitySkillIds: [2] })).toBe(0);
  });
});

describe("quality blend", () => {
  const now = Date.parse("2026-07-27T00:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  it("decays freshness by half over one half-life", () => {
    expect(freshnessFactor(daysAgo(0), now)).toBeCloseTo(1, 5);
    expect(freshnessFactor(daysAgo(180), now)).toBeCloseTo(0.5, 5);
    expect(freshnessFactor(null, now)).toBe(0);
    expect(freshnessFactor("not-a-date", now)).toBe(0);
  });

  it("saturates the score factor so rating gaps cannot dominate", () => {
    expect(scoreFactor(0)).toBe(0);
    expect(scoreFactor(50)).toBeCloseTo(0.5, 5);
    expect(scoreFactor(1_000_000)).toBeLessThan(1);
    expect(scoreFactor(null)).toBe(0);
    expect(scoreFactor(-10)).toBe(0);
  });

  it("lets a fresher, richer entry outrank a slightly higher-rated stale one", () => {
    const stale = qualityBlend(
      { score: 100, createdAt: daysAgo(900), richness: 0.1 },
      now,
    );
    const fresh = qualityBlend(
      { score: 80, createdAt: daysAgo(2), richness: 1 },
      now,
    );
    expect(fresh).toBeGreaterThan(stale);
  });

  it("still prefers the stronger entry when freshness and richness are equal", () => {
    const weak = qualityBlend({ score: 10, createdAt: daysAgo(30), richness: 0.5 }, now);
    const strong = qualityBlend({ score: 90, createdAt: daysAgo(30), richness: 0.5 }, now);
    expect(strong).toBeGreaterThan(weak);
  });

  it("keeps the blend inside 0..1", () => {
    const max = qualityBlend({ score: 10_000, createdAt: daysAgo(0), richness: 5 }, now);
    const min = qualityBlend({ score: null, createdAt: null, richness: -1 }, now);
    expect(max).toBeLessThanOrEqual(1);
    expect(min).toBeGreaterThanOrEqual(0);
  });
});

describe("composeRelevance", () => {
  it("reduces to the quality tail when there is no query and no facet", () => {
    expect(composeRelevance({ text: 0, facet: 0, quality: 0.42 })).toBe(0.42);
  });

  it("caps the quality tail at 1, so any larger text gap survives it", () => {
    // The tail is a tie-breaker, not a ranking signal of its own: quality can
    // never be worth more than a single point of text relevance.
    const strongText = composeRelevance({ text: 8, facet: 0, quality: 0 });
    const weakTextBestQuality = composeRelevance({ text: 6.9, facet: 0, quality: 1 });
    expect(strongText).toBeGreaterThan(weakTextBestQuality);
  });

  it("breaks an exact text tie on quality", () => {
    const rich = composeRelevance({ text: 8, facet: 0, quality: 0.9 });
    const bare = composeRelevance({ text: 8, facet: 0, quality: 0.1 });
    expect(rich).toBeGreaterThan(bare);
  });
});

describe("normalizeSort", () => {
  it("accepts the four known sorts", () => {
    expect(normalizeSort("forYou")).toBe("forYou");
    expect(normalizeSort("relevance")).toBe("relevance");
    expect(normalizeSort("rating")).toBe("rating");
    expect(normalizeSort("newest")).toBe("newest");
  });

  it("falls back to relevance for anything else", () => {
    expect(normalizeSort("bogus")).toBe("relevance");
    expect(normalizeSort(null)).toBe("relevance");
    expect(normalizeSort(undefined)).toBe("relevance");
  });
});

describe("normalizePerPage / normalizePage / pageOffset", () => {
  it("accepts only 12/24/48 page sizes, else 12", () => {
    expect(normalizePerPage(12)).toBe(12);
    expect(normalizePerPage(24)).toBe(24);
    expect(normalizePerPage(48)).toBe(48);
    expect(normalizePerPage(30)).toBe(12);
    expect(normalizePerPage(0)).toBe(12);
    expect(normalizePerPage(null)).toBe(12);
    expect(normalizePerPage(undefined)).toBe(12);
  });

  it("clamps page to a positive 1-based value", () => {
    expect(normalizePage(3)).toBe(3);
    expect(normalizePage(1)).toBe(1);
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(-5)).toBe(1);
    expect(normalizePage(null)).toBe(1);
  });

  it("computes a zero-based offset", () => {
    expect(pageOffset(1, 12)).toBe(0);
    expect(pageOffset(2, 12)).toBe(12);
    expect(pageOffset(3, 24)).toBe(48);
  });
});

describe("projectComparator", () => {
  const item = (relevance: number, score: number | null, created_at: string | null) => ({
    relevance,
    score,
    created_at,
  });

  it("relevance sort orders by relevance desc, then score desc", () => {
    const rows = [item(1, 100, null), item(5, 1, null), item(5, 9, null)];
    const sorted = [...rows].sort(projectComparator("relevance"));
    expect(sorted.map((r) => [r.relevance, r.score])).toEqual([
      [5, 9],
      [5, 1],
      [1, 100],
    ]);
  });

  it("rating sort orders by score desc, then relevance desc", () => {
    const rows = [item(9, 5, null), item(1, 10, null), item(3, 10, null)];
    const sorted = [...rows].sort(projectComparator("rating"));
    expect(sorted.map((r) => [r.score, r.relevance])).toEqual([
      [10, 3],
      [10, 1],
      [5, 9],
    ]);
  });

  it("newest sort orders by created_at desc and treats null as epoch", () => {
    const rows = [
      item(0, 0, "2026-01-01T00:00:00Z"),
      item(0, 0, "2026-06-01T00:00:00Z"),
      item(0, 0, null),
    ];
    const sorted = [...rows].sort(projectComparator("newest"));
    expect(sorted.map((r) => r.created_at)).toEqual([
      "2026-06-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
      null,
    ]);
  });

  it("treats null score as 0", () => {
    const rows = [item(0, null, null), item(0, 1, null)];
    const sorted = [...rows].sort(projectComparator("rating"));
    expect(sorted[0].score).toBe(1);
  });

  it("forYou sort leads with the personal blend, then relevance, then score", () => {
    const rows = [
      { ...item(9, 100, null), personal: 0.1 },
      { ...item(1, 1, null), personal: 0.9 },
      { ...item(5, 1, null), personal: 0.9 },
    ];
    const sorted = [...rows].sort(projectComparator("forYou"));
    expect(sorted.map((r) => [r.personal, r.relevance])).toEqual([
      [0.9, 5],
      [0.9, 1],
      [0.1, 9],
    ]);
  });

  it("forYou treats a missing personal score as 0", () => {
    const rows: Array<ReturnType<typeof item> & { personal?: number }> = [
      item(1, 1, null),
      { ...item(0, 0, null), personal: 0.5 },
    ];
    const sorted = [...rows].sort(projectComparator("forYou"));
    expect(sorted[0].personal).toBe(0.5);
  });
});

describe("profileComparator", () => {
  const p = (
    relevance: number,
    score: number | null,
    name: string | null,
    username: string,
    created_at: string | null = null,
  ) => ({ relevance, score, name, username, created_at });

  it("relevance sort breaks final ties alphabetically by name→username", () => {
    const rows = [p(5, 10, "Zoe", "zoe"), p(5, 10, "Ada", "ada")];
    const sorted = [...rows].sort(profileComparator("relevance"));
    expect(sorted.map((r) => r.name)).toEqual(["Ada", "Zoe"]);
  });

  it("falls back to username when name is null in the alpha tiebreak", () => {
    const rows = [p(5, 10, null, "zoe"), p(5, 10, null, "ada")];
    const sorted = [...rows].sort(profileComparator("relevance"));
    expect(sorted.map((r) => r.username)).toEqual(["ada", "zoe"]);
  });

  it("rating sort orders by score desc then relevance desc", () => {
    const rows = [p(9, 5, "a", "a"), p(1, 10, "b", "b")];
    const sorted = [...rows].sort(profileComparator("rating"));
    expect(sorted.map((r) => r.score)).toEqual([10, 5]);
  });
});
