import { NextResponse } from "next/server";
import { listPendingCompanyInvitations } from "@/lib/db/companies";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/company-invitations — invitations waiting for the signed-in
 * person's answer. Guests get an empty list.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ invitations: [] });
  }

  const invitations = await listPendingCompanyInvitations(supabase, user.id);
  return NextResponse.json({ invitations });
}
