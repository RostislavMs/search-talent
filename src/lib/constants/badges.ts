export const BADGE_KEYS = [
  "first_project",
  "storyteller",
  "prolific",
  "conversationalist",
  "loved",
  "community_voice",
  "rising_star",
  "top_100_all_time",
  "top_10_monthly",
  "project_of_the_month",
  "hall_of_fame",
  "verified_email",
  "complete_profile",
  "verified_github",
  "veteran",
  "early_adopter",
] as const;

export type BadgeKey = (typeof BADGE_KEYS)[number];

export const BADGE_CATEGORIES = [
  "creator",
  "community",
  "recognition",
  "profile",
] as const;

export type BadgeCategory = (typeof BADGE_CATEGORIES)[number];

export const BADGE_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "very_rare",
] as const;

export type BadgeRarity = (typeof BADGE_RARITIES)[number];

export type BadgeDefinition = {
  id: number;
  key: BadgeKey;
  nameEn: string;
  nameUk: string;
  descriptionEn: string;
  descriptionUk: string;
  category: BadgeCategory;
  emoji: string;
  rarity: BadgeRarity;
  sortOrder: number;
  /**
   * Ordered ascending thresholds for tier upgrades. Length 1 = single-tier
   * badge (earned at the first threshold). Length 3 = full progression.
   */
  tierThresholds: number[];
};

export type UserBadge = {
  badge: BadgeDefinition;
  /** 1, 2, or 3 — current progression level for the badge. */
  tier: number;
  awardedAt: string;
};

/**
 * A badge plus whether the user has earned it. `tier` is 0 when locked,
 * 1-3 once earned. Used by the profile shelf to show both earned and
 * locked badges so the catalog stays visible as motivation.
 */
export type BadgeWithProgress = {
  badge: BadgeDefinition;
  earned: boolean;
  tier: number;
  awardedAt: string | null;
};

export const MAX_BADGE_TIER = 3;

/**
 * Max bonus points that badges can add to a user's rating.
 * Capped — earning more badges past the cap is for display only.
 */
export const BADGE_RATING_BONUS_CAP = 5;

/**
 * Profile completeness threshold (0–1) for awarding the `complete_profile`
 * badge.
 */
export const COMPLETE_PROFILE_BADGE_THRESHOLD = 0.9;

/**
 * All-time and monthly leaderboard size thresholds that gate recognition
 * badges. Aligned with the leaderboard cutoff in `getLeaderboards`.
 */
export const TOP_100_THRESHOLD = 100;
export const TOP_10_THRESHOLD = 10;

/**
 * Monthly rank cutoff for the softer `rising_star` recognition badge — a
 * gentler step than `top_10_monthly`, awarded for reaching the monthly top-50.
 */
export const RISING_STAR_MONTHLY_THRESHOLD = 50;

/**
 * Minimum competitive pool (creators/projects with a real rating > 0) required
 * before a recognition badge is awarded. A rank is only meaningful once enough
 * peers actually compete for it — below the floor we award nothing, so a tiny
 * early user base doesn't hand every recognition badge to everyone. Tune these
 * up as the platform grows.
 */
export const RECOGNITION_MIN_POOL: Record<
  | "top_100_all_time"
  | "top_10_monthly"
  | "hall_of_fame"
  | "rising_star"
  | "project_of_the_month",
  number
> = {
  rising_star: 30,
  top_100_all_time: 50,
  top_10_monthly: 20,
  project_of_the_month: 15,
  hall_of_fame: 25,
};

/**
 * Registration-rank cutoff for the `early_adopter` ("Pioneer") badge: the
 * first N users to ever register earn it permanently. Mirrors the literal used
 * by `award_badges_for_user` in supabase/30_more_badges.sql — keep them in sync.
 */
export const EARLY_ADOPTER_MAX_RANK = 500;
