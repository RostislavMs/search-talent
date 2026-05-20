import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

function buildLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    },
  );
}

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();

  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanup = now;

  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * @param key     Unique identifier (e.g. `vote:${userId}`).
 * @param limit   Max requests allowed in the window.
 * @param windowMs  Window duration in milliseconds.
 * @returns `null` if allowed, or a 429 NextResponse if rate-limited.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  cleanup();

  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return buildLimitedResponse(retryAfterSeconds);
  }

  entry.count += 1;
  return null;
}

/**
 * Postgres-backed rate limiter shared across all serverless instances.
 *
 * Calls the `check_rate_limit` RPC defined in
 * `database/2026-05-20-rate-limits.sql`. The RPC returns the seconds the
 * caller must wait if blocked, or `0` if the request fits in the window.
 *
 * If the RPC is missing or errors out (e.g. the migration has not been
 * applied yet) we fall back to the in-memory limiter so legit users are
 * never silently allowed past the gate.
 */
export async function dbRateLimit(
  supabase: SupabaseClient,
  key: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });

    if (!error && typeof data === "number") {
      if (data === 0) return null;
      return buildLimitedResponse(data);
    }
  } catch {
    // fall through to the in-memory limiter
  }

  return rateLimit(key, limit, windowMs);
}
