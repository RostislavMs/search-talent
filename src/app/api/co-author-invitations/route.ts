import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/lib/db/co-authors";

/**
 * GET /api/co-author-invitations
 * Pending co-author invitations addressed to the current user, across projects,
 * articles and polls. Returns an empty list for anonymous callers.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ invitations: [] });
  }

  const invitations = await listPendingInvitationsForUser(supabase, user.id);
  return NextResponse.json({ invitations });
}
