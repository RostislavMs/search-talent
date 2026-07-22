import { describe, expect, it, vi } from "vitest";

// db/badges.ts is a server-only module; stub the guard so it imports in node.
vi.mock("server-only", () => ({}));

import { getBadgeBonusPoints } from "@/lib/db/badges";
import { BADGE_RATING_BONUS_CAP } from "@/lib/constants/badges";

describe("getBadgeBonusPoints", () => {
  it("awards one point per badge below the cap", () => {
    expect(getBadgeBonusPoints(1)).toBe(1);
    expect(getBadgeBonusPoints(3)).toBe(3);
  });

  it("caps the bonus at BADGE_RATING_BONUS_CAP", () => {
    expect(getBadgeBonusPoints(BADGE_RATING_BONUS_CAP)).toBe(BADGE_RATING_BONUS_CAP);
    expect(getBadgeBonusPoints(BADGE_RATING_BONUS_CAP + 10)).toBe(BADGE_RATING_BONUS_CAP);
  });

  it("returns 0 for zero, negative, or non-finite counts", () => {
    expect(getBadgeBonusPoints(0)).toBe(0);
    expect(getBadgeBonusPoints(-3)).toBe(0);
    expect(getBadgeBonusPoints(Number.NaN)).toBe(0);
    // Infinity is not finite, so it is rejected before the cap is applied.
    expect(getBadgeBonusPoints(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("floors fractional counts", () => {
    expect(getBadgeBonusPoints(2.9)).toBe(2);
  });
});
