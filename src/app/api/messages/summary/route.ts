import { NextResponse } from "next/server";
import { getMessagingSummary } from "@/lib/db/messages";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/messages/summary — the header badge: conversations with something
 * new (one's own and each company inbox) and requests waiting. Polled like the
 * notification bell.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ summary: await getMessagingSummary(supabase) });
}
