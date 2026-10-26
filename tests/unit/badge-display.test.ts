import { describe, expect, it } from "vitest";

import {
  getBadgeName,
  getNextBadgeLevel,
  getPublicBadges,
} from "@/lib/badge-display";
import type { BadgeDefinition, BadgeWithProgress } from "@/lib/constants/badges";

function badge(overrides: Partial<BadgeDefinition> = {}): BadgeDefinition {
  return {
    id: 1,
    key: "prolific",
    nameEn: "10+ works",
    nameUk: "10+ робіт",
    descriptionEn: "Published projects or articles, whichever is more.",
    descriptionUk: "Опубліковані проєкти або статті — рахується більше з двох.",
    category: "creator",
    emoji: "🎯",
    rarity: "uncommon",
    sortOrder: 60,
    tierThresholds: [10, 25, 50],
    tierNamesEn: ["10+ works", "25+ works", "50+ works"],
    tierNamesUk: ["10+ робіт", "25+ робіт", "50+ робіт"],
    publicOnProfile: true,
    ...overrides,
  };
}

function entry(overrides: Partial<BadgeWithProgress> = {}): BadgeWithProgress {
  return {
    badge: badge(),
    earned: true,
    tier: 1,
    awardedAt: "2026-06-10T21:53:47Z",
    progress: null,
    ...overrides,
  };
}

const singleTier = badge({
  id: 2,
  key: "verified_github",
  nameEn: "GitHub connected",
  nameUk: "GitHub підключено",
  tierThresholds: [1],
  tierNamesEn: null,
  tierNamesUk: null,
});

describe("getBadgeName", () => {
  it("names the tier reached", () => {
    expect(getBadgeName(badge(), 3, "uk")).toBe("50+ робіт");
    expect(getBadgeName(badge(), 2, "en")).toBe("25+ works");
  });

  it("reads a locked badge as its first tier", () => {
    expect(getBadgeName(badge(), 0, "uk")).toBe("10+ робіт");
  });

  it("clamps a tier past the last name", () => {
    expect(getBadgeName(badge(), 7, "en")).toBe("50+ works");
  });

  it("falls back to the plain name for single-tier badges", () => {
    expect(getBadgeName(singleTier, 1, "uk")).toBe("GitHub підключено");
    expect(getBadgeName(singleTier, 1, "en")).toBe("GitHub connected");
  });
});

describe("getPublicBadges", () => {
  it("keeps earned public badges in the given order", () => {
    const owned = entry({ badge: singleTier });
    const ownerOnly = entry({
      badge: badge({ id: 3, key: "verified_email", publicOnProfile: false }),
    });
    const locked = entry({ badge: badge({ id: 4 }), earned: false, tier: 0 });

    expect(getPublicBadges([entry(), ownerOnly, owned, locked])).toEqual([entry(), owned]);
  });
});

describe("getNextBadgeLevel", () => {
  it("points at the next tier with the owner's count", () => {
    expect(getNextBadgeLevel(entry({ tier: 1, progress: 12 }), "uk")).toEqual({
      name: "25+ робіт",
      threshold: 25,
      current: 12,
    });
  });

  it("points a locked badge at its first tier", () => {
    expect(
      getNextBadgeLevel(entry({ earned: false, tier: 0, awardedAt: null, progress: 7 }), "en"),
    ).toEqual({ name: "10+ works", threshold: 10, current: 7 });
  });

  it("has nothing past the top tier or for single-tier badges", () => {
    expect(getNextBadgeLevel(entry({ tier: 3 }), "uk")).toBeNull();
    expect(getNextBadgeLevel(entry({ badge: singleTier }), "uk")).toBeNull();
  });

  it("caps a count the award hasn't caught up with yet", () => {
    expect(getNextBadgeLevel(entry({ tier: 1, progress: 30 }), "en")?.current).toBe(25);
  });

  it("leaves the count unknown when there is no progress", () => {
    expect(getNextBadgeLevel(entry({ tier: 2 }), "en")?.current).toBeNull();
  });
});
