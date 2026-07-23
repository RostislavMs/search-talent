import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import {
  LEADERBOARDS_CACHE_TAG,
  refreshLeaderboardSnapshot,
} from "@/lib/db/leaderboards";

// Recompute + persist the leaderboard snapshot on a schedule (see vercel.json
// crons). Decouples the expensive O(projects × profiles) computation from user
// requests: page renders and the talents search only ever read the snapshot.
//
// Schedule: vercel.json runs this daily ("0 3 * * *"). The Hobby plan REJECTS
// any cron more frequent than once per day at deploy time, so daily is the
// backstop; freshness between runs is handled by the lazy self-heal in
// readLeaderboardSnapshot (recomputes when the snapshot ages past
// LEADERBOARD_SNAPSHOT_STALE_SECONDS). On Pro, bump the schedule to "*/15 * * * *"
// so the refresh never lands on a user request.
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. When CRON_SECRET
// is set we require it, so the endpoint can't be triggered by the public. When
// it is unset (e.g. local dev) the route is open.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const data = await refreshLeaderboardSnapshot();
    // Flush the read cache so the next request picks up the fresh snapshot.
    revalidateTag(LEADERBOARDS_CACHE_TAG, "max");

    return NextResponse.json({
      ok: true,
      creators: {
        all: data.result.creators.all.length,
        month: data.result.creators.month.length,
      },
      projects: {
        all: data.result.projects.all.length,
        month: data.result.projects.month.length,
      },
      ratedCreators: Object.keys(data.creatorRatings).length,
      ratedProjects: Object.keys(data.projectRatings).length,
    });
  } catch (error) {
    console.error("refresh-leaderboard cron failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

// Allow manual/administrative triggering via POST as well.
export async function POST(request: Request) {
  return handle(request);
}
