import { NextResponse } from "next/server";

import { isGifSearchConfigured, searchGifs } from "@/lib/gif/provider";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gif/search?q=<query>&limit=<n>
 * Server-side proxy to the GIF provider so the API key never reaches the
 * browser. Auth-gated and rate-limited. An empty query returns trending GIFs.
 */
export async function GET(request: Request) {
  if (!isGifSearchConfigured()) {
    return NextResponse.json(
      { error: "GIF search is not configured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await dbRateLimit(supabase, `gif-search:${user.id}`, 60, 60_000);
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").slice(0, 100);
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, 50)
      : 30;
  const offsetParam = Number(searchParams.get("offset"));
  const offset =
    Number.isFinite(offsetParam) && offsetParam > 0
      ? Math.min(offsetParam, 4999)
      : 0;

  try {
    const gifs = await searchGifs(q, { limit, offset });
    return NextResponse.json({ gifs });
  } catch {
    return NextResponse.json({ error: "Failed to load GIFs" }, { status: 502 });
  }
}
