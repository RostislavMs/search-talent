import { describe, expect, it } from "vitest";
import {
  rankRelatedCreators,
  tallySharedSkills,
  type CreatorRankInput,
  type SkillLink,
} from "@/lib/related";

// ---------------------------------------------------------------------------
// tallySharedSkills
// ---------------------------------------------------------------------------

describe("tallySharedSkills", () => {
  const links: SkillLink[] = [
    { entityId: "self", skillId: 1 },
    { entityId: "self", skillId: 2 },
    { entityId: "a", skillId: 1 },
    { entityId: "a", skillId: 2 },
    { entityId: "a", skillId: 9 }, // not a reference skill
    { entityId: "b", skillId: 2 },
    { entityId: "c", skillId: 7 }, // shares nothing
  ];

  it("counts only links whose skill is in the reference set", () => {
    const counts = tallySharedSkills(links, [1, 2], "self");
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });

  it("excludes the reference entity itself", () => {
    const counts = tallySharedSkills(links, [1, 2], "self");
    expect(counts.has("self")).toBe(false);
  });

  it("omits entities that share no reference skill", () => {
    const counts = tallySharedSkills(links, [1, 2], "self");
    expect(counts.has("c")).toBe(false);
  });

  it("returns an empty map when there are no reference skills", () => {
    expect(tallySharedSkills(links, [], "self").size).toBe(0);
  });

  it("ignores reference skills that are mere duplicates", () => {
    const counts = tallySharedSkills(links, [1, 1, 2], "self");
    expect(counts.get("a")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// rankRelatedCreators
// ---------------------------------------------------------------------------

describe("rankRelatedCreators", () => {
  const make = (
    id: string,
    sharedSkillCount: number,
    sameCategory: boolean,
    createdAt: string | null = null,
  ): CreatorRankInput => ({ id, sharedSkillCount, sameCategory, createdAt });

  it("ranks shared-skill overlap above category match", () => {
    const ranked = rankRelatedCreators(
      [make("category", 0, true), make("skills", 2, false)],
      10,
    );
    expect(ranked.map((item) => item.id)).toEqual(["skills", "category"]);
  });

  it("keeps same-category creators even with zero skill overlap", () => {
    const ranked = rankRelatedCreators([make("peer", 0, true)], 10);
    expect(ranked.map((item) => item.id)).toEqual(["peer"]);
  });

  it("drops creators with no overlap and a different category", () => {
    const ranked = rankRelatedCreators(
      [make("keep", 1, false), make("drop", 0, false)],
      10,
    );
    expect(ranked.map((item) => item.id)).toEqual(["keep"]);
  });

  it("breaks equal-skill ties on same-category, then recency", () => {
    const ranked = rankRelatedCreators(
      [
        make("plain-old", 1, false, "2024-01-01T00:00:00Z"),
        make("same-cat", 1, true, "2024-01-01T00:00:00Z"),
        make("plain-new", 1, false, "2026-01-01T00:00:00Z"),
      ],
      10,
    );
    expect(ranked.map((item) => item.id)).toEqual([
      "same-cat",
      "plain-new",
      "plain-old",
    ]);
  });

  it("caps the result at the requested limit", () => {
    const ranked = rankRelatedCreators(
      [make("a", 3, false), make("b", 2, false), make("c", 1, false)],
      2,
    );
    expect(ranked.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
