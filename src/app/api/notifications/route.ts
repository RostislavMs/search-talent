import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hydrateNotificationActors,
  listNotifications,
} from "@/lib/db/notifications";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/constants/notifications";

/**
 * GET /api/notifications?before=<iso>&limit=<n>
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limitRaw = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 100)
      : NOTIFICATIONS_PAGE_SIZE;

  const items = await listNotifications(supabase, {
    recipientUserId: user.id,
    limit,
    before,
  });

  const hydrated = await hydrateNotificationActors(supabase, items);

  return NextResponse.json({
    notifications: hydrated,
    nextCursor:
      hydrated.length === limit ? hydrated[hydrated.length - 1].createdAt : null,
  });
}
