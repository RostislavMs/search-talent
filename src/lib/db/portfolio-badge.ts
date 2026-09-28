import "server-only";

import { getCreatorRatings } from "@/lib/db/leaderboards";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createPublicReadOnlyClient } from "@/lib/supabase/admin";

export type PortfolioBadgeData =
  | { found: false }
  | { found: true; rating: number | null };

/**
 * What the README badge shows for a username: the same rating as the profile
 * page, or null before the profile is ranked. A profile the page would 404 on
 * (hidden, or a username that does not match exactly) is "not found" here too.
 *
 * Reads with the anonymous key and no cookies: the badge is public and cached
 * by the CDN, so nothing about the viewer may shape it.
 */
export async function getPortfolioBadgeData(
  username: string,
): Promise<PortfolioBadgeData> {
  const supabase = createPublicReadOnlyClient();

  if (!supabase) {
    return { found: false };
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, moderation_status")
    .eq("username", username)
    .maybeSingle<{ id: string; moderation_status: string | null }>();

  if (!data || !isPublicModerationStatus(data.moderation_status)) {
    return { found: false };
  }

  const ratings = await getCreatorRatings();
  return { found: true, rating: ratings[data.id] ?? null };
}
