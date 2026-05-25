import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BADGE_RATING_BONUS_CAP,
  type BadgeCategory,
  type BadgeDefinition,
  type BadgeKey,
  type BadgeRarity,
  type BadgeWithProgress,
  type UserBadge,
} from "@/lib/constants/badges";

type BadgeRow = {
  id: number;
  key: string;
  name_en: string;
  name_uk: string;
  description_en: string;
  description_uk: string;
  category: string;
  emoji: string;
  rarity: string;
  sort_order: number;
  tier_thresholds: number[] | null;
};

type UserBadgeRow = {
  badge_id: number;
  tier: number | null;
  awarded_at: string;
  badges: BadgeRow | BadgeRow[] | null;
};

function mapBadgeRow(row: BadgeRow): BadgeDefinition {
  return {
    id: row.id,
    key: row.key as BadgeKey,
    nameEn: row.name_en,
    nameUk: row.name_uk,
    descriptionEn: row.description_en,
    descriptionUk: row.description_uk,
    category: row.category as BadgeCategory,
    emoji: row.emoji,
    rarity: row.rarity as BadgeRarity,
    sortOrder: row.sort_order,
    tierThresholds: row.tier_thresholds ?? [1],
  };
}

function pickBadgeRow(value: BadgeRow | BadgeRow[] | null): BadgeRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/**
 * Public read: list all badge definitions sorted by `sort_order`.
 */
export async function listBadgeCatalog(
  supabase: SupabaseClient,
): Promise<BadgeDefinition[]> {
  const { data } = await supabase
    .from("badges")
    .select(
      "id, key, name_en, name_uk, description_en, description_uk, category, emoji, rarity, sort_order, tier_thresholds",
    )
    .order("sort_order", { ascending: true });

  return ((data || []) as BadgeRow[]).map(mapBadgeRow);
}

/**
 * Returns the badges that a user has earned, joined with badge metadata.
 * Ordered by `awarded_at` desc so newest awards surface first.
 */
export async function listUserBadges(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserBadge[]> {
  const { data } = await supabase
    .from("user_badges")
    .select(
      `
      badge_id,
      tier,
      awarded_at,
      badges (
        id, key, name_en, name_uk, description_en, description_uk,
        category, emoji, rarity, sort_order, tier_thresholds
      )
    `,
    )
    .eq("user_id", userId)
    .order("awarded_at", { ascending: false });

  const rows = (data || []) as UserBadgeRow[];

  return rows
    .map((row) => {
      const badgeRow = pickBadgeRow(row.badges);
      if (!badgeRow) return null;
      return {
        badge: mapBadgeRow(badgeRow),
        tier: Math.max(1, Math.min(3, row.tier ?? 1)),
        awardedAt: row.awarded_at,
      };
    })
    .filter((entry): entry is UserBadge => entry !== null);
}

/**
 * Returns every badge in the catalog joined with the user's progress.
 * Earned badges come first (most recent award up top); locked badges keep
 * their sort_order. Used by the public profile shelf so visitors can see
 * both earned achievements and the rest of the catalog as motivation.
 */
export async function listBadgesWithProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<BadgeWithProgress[]> {
  const [catalog, earned] = await Promise.all([
    listBadgeCatalog(supabase),
    listUserBadges(supabase, userId),
  ]);

  const earnedByBadgeId = new Map(
    earned.map((entry) => [entry.badge.id, entry] as const),
  );

  const merged: BadgeWithProgress[] = catalog.map((badge) => {
    const entry = earnedByBadgeId.get(badge.id);
    if (entry) {
      return {
        badge,
        earned: true,
        tier: entry.tier,
        awardedAt: entry.awardedAt,
      };
    }
    return { badge, earned: false, tier: 0, awardedAt: null };
  });

  merged.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned && b.earned) {
      const left = a.awardedAt ? Date.parse(a.awardedAt) : 0;
      const right = b.awardedAt ? Date.parse(b.awardedAt) : 0;
      return right - left;
    }
    return a.badge.sortOrder - b.badge.sortOrder;
  });

  return merged;
}

/**
 * Returns just the count of badges earned by a user. Cheaper than a join
 * when only the rating bonus is needed.
 */
export async function getUserBadgeCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("user_badges")
    .select("badge_id", { count: "exact", head: true })
    .eq("user_id", userId);

  return count ?? 0;
}

/**
 * Bulk variant: returns badge counts for many users in one round trip.
 * Used by the leaderboard so we can apply the rating bonus per creator.
 */
export async function getBadgeCountsForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  if (userIds.length === 0) {
    return result;
  }

  const { data } = await supabase
    .from("user_badges")
    .select("user_id")
    .in("user_id", userIds);

  for (const row of (data || []) as Array<{ user_id: string }>) {
    result.set(row.user_id, (result.get(row.user_id) ?? 0) + 1);
  }

  return result;
}

/**
 * Calls the SQL evaluator that awards the 8 SQL-derivable badges. The other
 * 4 (complete_profile, top_100_all_time, top_10_monthly, hall_of_fame) are
 * awarded from the TypeScript layer because they depend on metrics computed
 * outside of SQL.
 *
 * Errors are logged but do not throw — badge awards must never block the
 * source mutation that triggered them.
 */
export async function awardSqlBadgesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (!userId) return;

  const { error } = await supabase.rpc("award_badges_for_user", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[badges] award_badges_for_user failed", error);
  }
}

/**
 * Awards a single badge to a user by `key`. Idempotent via the
 * `(user_id, badge_id)` primary key. Used from the TS layer for the
 * leaderboard- and completeness-derived badges.
 */
export async function awardBadgeByKey(
  supabase: SupabaseClient,
  userId: string,
  key: BadgeKey,
  tier: number = 1,
): Promise<void> {
  if (!userId) return;

  const { error } = await supabase.rpc("upsert_user_badge", {
    p_user_id: userId,
    p_badge_key: key,
    p_tier: tier,
  });

  if (error) {
    console.error("[badges] upsert_user_badge failed", error);
  }
}

/**
 * Helper for the rating formula: 1 badge = +1 point, capped at
 * BADGE_RATING_BONUS_CAP.
 */
export function getBadgeBonusPoints(badgeCount: number): number {
  if (!Number.isFinite(badgeCount) || badgeCount <= 0) return 0;
  return Math.min(BADGE_RATING_BONUS_CAP, Math.floor(badgeCount));
}
