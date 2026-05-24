import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { listUserRepos } from "@/lib/integrations/github";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/integrations/github/repos
 * Returns the viewer's GitHub repositories (owned + collaborator).
 * Token never leaves the server — only metadata is returned.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`gh-repos:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const integration = await getIntegrationForUser(supabase, user.id);
  if (!integration) {
    return NextResponse.json(
      { error: "GitHub is not connected" },
      { status: 409 },
    );
  }

  const repos = await listUserRepos(integration.access_token);
  return NextResponse.json({ repos });
}
