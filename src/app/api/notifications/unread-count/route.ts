import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countUnreadNotifications } from "@/lib/db/notifications";

/**
 * GET /api/notifications/unread-count
 * Lightweight endpoint polled by the bell icon every 30-60s.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  const count = await countUnreadNotifications(supabase, user.id);

  return NextResponse.json({ count }, {
    headers: { "Cache-Control": "no-store" },
  });
}
