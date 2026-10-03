import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildHiringMetrics,
  type HiringApplicationRow,
  type HiringMetrics,
  type HiringSignalsRow,
  type HiringVacancyRow,
} from "@/lib/hiring-metrics";
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

const RPC_PAGE = 1000;

/** Every row a set-returning function gives, page by page (the API stops at 1 000). */
async function rpcRows<T>(
  admin: SupabaseClient,
  name: string,
  args?: Record<string, unknown>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += RPC_PAGE) {
    const { data, error } = await admin.rpc(name, args).range(from, from + RPC_PAGE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const chunk = (data ?? []) as T[];
    rows.push(...chunk);

    if (chunk.length < RPC_PAGE) {
      return rows;
    }
  }
}

/**
 * Hiring numbers for /admin/metrics (stage 8.4). Null without the service key
 * or before the database has the functions: the page then leaves the section
 * out with a note.
 */
export async function getHiringMetrics(now: Date = new Date()): Promise<HiringMetrics | null> {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const since = `${lastWeekStarts(now, METRICS_WEEKS)[0]}T00:00:00Z`;

  try {
    const [vacancies, applications, signals] = await Promise.all([
      rpcRows<HiringVacancyRow>(admin, "admin_metrics_hiring_vacancies"),
      rpcRows<HiringApplicationRow>(admin, "admin_metrics_hiring_applications", { p_since: since }),
      rpcRows<HiringSignalsRow>(admin, "admin_metrics_hiring_signals"),
    ]);

    return buildHiringMetrics({ vacancies, applications, signals: signals[0] ?? null, now });
  } catch (error) {
    console.error("[product-metrics] hiring metrics unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
