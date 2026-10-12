import { NextResponse } from "next/server";
import { searchMessages } from "@/lib/db/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { messageSearchQuerySchema } from "@/lib/validation/messages";

/**
 * GET /api/messages/search?q=&company= — the caller's messages (or a
 * company's team inbox) with the text, and conversations whose name matches.
 * search_messages() looks only where the caller may read.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  // Typing asks once per pause; this only stops a loop hammering it.
  const limited = rateLimit(`messages-search:${user.id}`, 60, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = messageSearchQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", code: "invalid" }, { status: 400 });
  }

  const results = await searchMessages(supabase, parsed.data.q, parsed.data.company ?? null);
  return NextResponse.json({ results });
}
