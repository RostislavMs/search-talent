import { NextResponse } from "next/server";
import { expireVacancies } from "@/lib/db/vacancies";

// Marks vacancies whose 60 days ran out as expired and tells their authors
// (see vercel.json crons; daily, like refresh-leaderboard — the Hobby plan
// allows nothing more frequent). Pages do not wait for it: anything past its
// expires_at is already treated as expired when read (resolveVacancyState),
// so the cron only settles the status and sends the notifications.
//
// Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. When the
// secret is set it is required; without it (local dev) the route is open.
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
    const expired = await expireVacancies();
    return NextResponse.json({ ok: true, expired });
  } catch (error) {
    console.error("expire-vacancies cron failed:", error);
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
