import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const routeSchema = z.object({ id: z.string().uuid() });

/**
 * POST /api/projects/:id/unlink-github
 *
 * Detaches the project from its GitHub repository and clears every
 * github_* column (stats, narrative fields, display options, README,
 * auto-sync flag). Owner-only.
 *
 * Note: tech_stack is left intact because it doubles as a manual tag
 * list once the link is removed — wiping it would silently drop the
 * user's technology pills.
 */
export async function POST(
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

  const limited = rateLimit(`gh-unlink:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const parsed = routeSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("projects")
    .update({
      github_repo_id: null,
      github_full_name: null,
      github_default_branch: null,
      github_synced_at: null,
      github_stats: null,
      github_readme: null,
      github_role: null,
      github_contribution: null,
      github_motivation: null,
      github_tech_decisions: null,
      github_learnings: null,
      github_showcase_notes: null,
      github_production_usage: null,
      github_auto_sync: false,
    })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
