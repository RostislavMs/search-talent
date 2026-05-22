import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteNotification } from "@/lib/db/notifications";

const routeSchema = z.object({ id: z.string().uuid() });

/**
 * DELETE /api/notifications/:id
 * Removes a single notification owned by the current user.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = routeSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const ok = await deleteNotification(supabase, {
    recipientUserId: user.id,
    id: parsed.data.id,
  });

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
