import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteIntegration,
  getIntegrationForUser,
  toIntegrationSummary,
} from "@/lib/db/github-integrations";

/**
 * GET /api/integrations/github — returns the current viewer's GitHub
 * integration summary (no access token), or `null` if not connected.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ integration: null });
  }

  const row = await getIntegrationForUser(supabase, user.id);
  return NextResponse.json({
    integration: row ? toIntegrationSummary(row) : null,
  });
}

/**
 * DELETE /api/integrations/github — disconnects the viewer's account.
 * GitHub-side revocation requires the OAuth app's basic auth; we
 * simply drop the local row to stop further sync calls.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await deleteIntegration(supabase, user.id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
