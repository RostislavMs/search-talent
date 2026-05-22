import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsAsRead } from "@/lib/db/notifications";
import { markNotificationsReadSchema } from "@/lib/validation/notifications";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/notifications/mark-read
 * Body: { ids?: uuid[], all?: boolean }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`notif-read:${user.id}`, 60, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonRequest(request, markNotificationsReadSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const updated = await markNotificationsAsRead(supabase, {
    recipientUserId: user.id,
    ids: parsed.data.ids,
    all: parsed.data.all,
  });

  return NextResponse.json({ updated });
}
