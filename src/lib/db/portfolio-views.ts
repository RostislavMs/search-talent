import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePortfolioViews, type PortfolioViews } from "@/lib/portfolio-views";

/**
 * The signed-in author's portfolio views for the last 30 days
 * (`my_portfolio_views()`). Null until the migration runs or on any error —
 * My Space then leaves the block out instead of showing made-up zeros.
 */
export async function getMyPortfolioViews(supabase: SupabaseClient): Promise<PortfolioViews | null> {
  const { data, error } = await supabase.rpc("my_portfolio_views");

  if (error) {
    return null;
  }

  return normalizePortfolioViews(data);
}
