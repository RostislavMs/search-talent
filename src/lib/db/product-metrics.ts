import "server-only";

import {
  buildProductMetrics,
  lastWeekStarts,
  METRICS_WEEKS,
  type MetricsUserRow,
  type MetricsViewRollupRow,
  type ProductMetrics,
} from "@/lib/product-metrics";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProductMetricsResult =
  | { status: "ok"; metrics: ProductMetrics }
  | { status: "unavailable"; reason: "no-service-key" | "not-migrated" };

/**
 * Data for /admin/metrics. The read functions are granted to the service role
 * only (they see every account), so this must stay behind requireAdmin — the
 * admin layout already enforces it.
 */
export async function getProductMetrics(
  now: Date = new Date(),
): Promise<ProductMetricsResult> {
  const admin = createAdminClient();

  if (!admin) {
    return { status: "unavailable", reason: "no-service-key" };
  }

  const since = `${lastWeekStarts(now, METRICS_WEEKS)[0]}T00:00:00Z`;

  const [usersResponse, viewsResponse] = await Promise.all([
    admin.rpc("admin_metrics_users"),
    admin.rpc("admin_metrics_view_rollup", { p_since: since }),
  ]);

  if (usersResponse.error || viewsResponse.error) {
    console.error(
      "[product-metrics] unavailable:",
      usersResponse.error?.message || viewsResponse.error?.message,
    );
    return { status: "unavailable", reason: "not-migrated" };
  }

  return {
    status: "ok",
    metrics: buildProductMetrics({
      users: (usersResponse.data ?? []) as MetricsUserRow[],
      views: (viewsResponse.data ?? []) as MetricsViewRollupRow[],
      now,
    }),
  };
}
