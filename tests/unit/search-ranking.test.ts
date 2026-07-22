import { describe, expect, it } from "vitest";
import {
  getProfileRelevanceScore,
  getProjectRelevanceScore,
  matchesQuery,
  normalizePage,
  normalizePerPage,
  pageOffset,
  profileComparator,
  projectComparator,
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
    const partial = getProjectRelevanceScore({ ...base, title: "react native kit" }, "react");
    expect(exact).toBeGreaterThan(partial);
    // exact title (12) + tech match (3); partial title (8) + tech match (3)
    expect(exact).toBe(15);
    expect(partial).toBe(11);
  });

  it("adds points for description, owner, and technology matches", () => {
    expect(getProjectRelevanceScore(base, "creatives")).toBe(4); // description only
    expect(getProjectRelevanceScore(base, "ada")).toBe(2); // owner username
    expect(getProjectRelevanceScore(base, "lovelace")).toBe(2); // owner name
    expect(getProjectRelevanceScore(base, "typescript")).toBe(3); // tech
  });

  it("accumulates across multiple fields", () => {
    // title partial (8) + description (4) + tech (3) = 15
    const input: ProjectRelevanceInput = {
      ...base,
      title: "react app",
      description: "built with react",
      technologies: ["React"],
    };
    expect(getProjectRelevanceScore(input, "react")).toBe(15);
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
    expect(getProfileRelevanceScore({ ...base, username: "rust" }, "rust")).toBe(12 + 3);
    expect(getProfileRelevanceScore({ ...base, username: "rustacean" }, "rust")).toBe(8 + 3);
  });

  it("weights name above headline above country", () => {
    expect(getProfileRelevanceScore(base, "lovelace")).toBe(6);
    expect(getProfileRelevanceScore(base, "thinker")).toBe(4);
    expect(getProfileRelevanceScore(base, "ukraine")).toBe(2);
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
