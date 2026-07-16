import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";

/**
 * POST /api/admin/refresh-scores
 *
 * Recomputes the persisted `score` column (Wilson-based, 0-100) on every
 * project and profile. Call this after bulk edits, media uploads, or data
 * migrations — any time vote-based scores may have drifted.
 *
 * The recompute runs entirely in Postgres via the `recompute_all_scores`
 * function (set-based, single statement per table). The previous version
 * paged rows into Node and issued one UPDATE per row, which both hit the
 * PostgREST 1000-row cap (silently truncating past 1000 votes/rows) and
 * fanned out into O(rows) round-trips.
 *
 * Requires admin authentication (also re-checked inside the SQL function).
 */
export async function POST() {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await context.supabase.rpc("recompute_all_scores");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
