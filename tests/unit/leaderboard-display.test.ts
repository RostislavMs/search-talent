import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_DISPLAY_SIZE,
  TOP_CREATOR_MIN_COMPLETENESS_PERCENT,
  TOP_PROJECTS_MAX_PER_OWNER,
} from "@/lib/constants/visibility";
import {
  isTopCreatorEligible,
  selectFreshCreators,
  selectTopCreators,
  selectTopProjects,
} from "@/lib/leaderboard-display";

function creator(
  id: string,
  projectCount: number,
  profileCompleteness: number,
  latestProjectAt: string | null = null,
) {
  return { id, projectCount, profileCompleteness, latestProjectAt };
}

function project(id: string, ownerUsername: string | null, title = `Project ${id}`) {
  return { id, title, description: null, ownerUsername };
}

describe("isTopCreatorEligible", () => {
  it("needs published work and a mostly complete profile", () => {
    expect(isTopCreatorEligible(creator("a", 1, TOP_CREATOR_MIN_COMPLETENESS_PERCENT))).toBe(true);
    expect(isTopCreatorEligible(creator("b", 0, 100))).toBe(false);
    expect(
      isTopCreatorEligible(creator("c", 5, TOP_CREATOR_MIN_COMPLETENESS_PERCENT - 1)),
    ).toBe(false);
  });
});

describe("selectTopCreators", () => {
  it("drops blank profiles but keeps the ranking order", () => {
    const ranked = [
      creator("first", 8, 94),
      creator("empty", 0, 51),
      creator("second", 21, 65),
      creator("thin", 1, 44),
    ];
    expect(selectTopCreators(ranked).map((c) => c.id)).toEqual(["first", "second"]);
  });

  it("refills up to the display size from further down the ranking", () => {
    const ranked = [
      creator("skip", 0, 90),
      ...Array.from({ length: LEADERBOARD_DISPLAY_SIZE + 3 }, (_, i) =>
        creator(`c${i}`, 1, 80),
      ),
    ];
    const selected = selectTopCreators(ranked);
    expect(selected).toHaveLength(LEADERBOARD_DISPLAY_SIZE);
    expect(selected[0].id).toBe("c0");
  });
});

describe("selectTopProjects", () => {
  it("caps how many projects one author places when others can fill the board", () => {
    const ranked = [
      project("1", "nyx"),
      project("2", "nyx"),
      project("3", "nyx"),
      project("4", "rostyslav"),
      project("5", "edward"),
    ];
    const selected = selectTopProjects(ranked, 4);
    expect(selected.map((p) => p.id)).toEqual(["1", "2", "4", "5"]);
    expect(
      selected.filter((p) => p.ownerUsername === "nyx"),
    ).toHaveLength(TOP_PROJECTS_MAX_PER_OWNER);
  });

  it("tops up with the next-best projects when too few authors fill the board", () => {
    const ranked = [
      project("1", "nyx"),
      project("2", "nyx"),
      project("3", "nyx"),
      project("4", "rostyslav"),
      project("5", "nyx"),
      project("6", "rostyslav"),
      project("7", "rostyslav"),
    ];
    // Different authors first, then the overflow in rank order.
    expect(selectTopProjects(ranked).map((p) => p.id)).toEqual([
      "1",
      "2",
      "4",
      "6",
      "3",
      "5",
      "7",
    ]);
    expect(selectTopProjects(ranked, 5).map((p) => p.id)).toEqual(["1", "2", "4", "6", "3"]);
  });

  it("caps ownerless projects individually instead of as one author", () => {
    const ranked = [project("a", null), project("b", null), project("c", null)];
    expect(selectTopProjects(ranked)).toHaveLength(3);
  });

  it("stops at the display size", () => {
    const ranked = Array.from({ length: 30 }, (_, i) => project(`${i}`, `owner-${i}`));
    expect(selectTopProjects(ranked)).toHaveLength(LEADERBOARD_DISPLAY_SIZE);
  });
});

describe("selectFreshCreators", () => {
  it("lists people with displayable work, newest first", () => {
    const creators = [
      creator("old", 3, 20, "2026-05-01T00:00:00Z"),
      creator("none", 0, 90, null),
      creator("new", 1, 10, "2026-09-19T00:00:00Z"),
      creator("flagged-only", 1, 70, null),
    ];
    expect(selectFreshCreators(creators).map((c) => c.id)).toEqual(["new", "old"]);
  });
});
