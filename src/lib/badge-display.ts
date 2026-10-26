import type { BadgeDefinition, BadgeWithProgress } from "@/lib/constants/badges";

/**
 * The badge's name at a tier: "50+ робіт" at tier 3. A locked badge (tier 0)
 * reads as its first tier, which is what earning it would give.
 */
export function getBadgeName(
  badge: BadgeDefinition,
  tier: number,
  locale: string,
): string {
  const name = locale === "uk" ? badge.nameUk : badge.nameEn;
  const tierNames = locale === "uk" ? badge.tierNamesUk : badge.tierNamesEn;
  if (!tierNames || tierNames.length === 0) return name;
  const index = Math.min(Math.max(tier, 1), tierNames.length) - 1;
  return tierNames[index] ?? name;
}

export function getBadgeDescription(badge: BadgeDefinition, locale: string): string {
  return locale === "uk" ? badge.descriptionUk : badge.descriptionEn;
}

/** Earned badges meant for the public profile, in catalog (weight) order. */
export function getPublicBadges(entries: BadgeWithProgress[]): BadgeWithProgress[] {
  return entries.filter((entry) => entry.earned && entry.badge.publicOnProfile);
}

export type NextBadgeLevel = {
  name: string;
  threshold: number;
  /** Null when the count isn't known (visitors never get it). */
  current: number | null;
};

/**
 * The level after the current one for a tiered badge — the first level while
 * it's locked. Null for single-tier badges and at the top level. The count is
 * capped at the threshold: past it, the award just hasn't run yet.
 */
export function getNextBadgeLevel(
  entry: BadgeWithProgress,
  locale: string,
): NextBadgeLevel | null {
  const thresholds = entry.badge.tierThresholds;
  if (thresholds.length <= 1 || entry.tier >= thresholds.length) return null;
  const threshold = thresholds[entry.tier];
  return {
    name: getBadgeName(entry.badge, entry.tier + 1, locale),
    threshold,
    current: entry.progress === null ? null : Math.min(entry.progress, threshold),
  };
}
