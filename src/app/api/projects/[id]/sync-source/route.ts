import { NextResponse } from "next/server";
import { z } from "zod";
import { syncProjectFromProvider } from "@/lib/db/provider-sync";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const routeSchema = z.object({ id: z.string().uuid() });

/**
 * POST /api/projects/:id/sync-source
 * Re-pulls the linked provider resource (GitLab project, Figma file) and
 * refreshes the project's denormalised columns. Owner-only.
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

  const limited = rateLimit(`pi-sync:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const parsed = routeSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const result = await syncProjectFromProvider(supabase, {
    projectId: parsed.data.id,
    ownerUserId: user.id,
  });

  if (!result.ok) {
    const statusByReason: Record<string, number> = {
      not_connected: 409,
      no_link: 409,
      not_found: 404,
      update_failed: 500,
    };
    return NextResponse.json(
      { error: result.reason },
      { status: statusByReason[result.reason] ?? 400 },
    );
  }

  return NextResponse.json({
    syncedAt: result.link.syncedAt,
    link: result.link,
    techStack: result.techStack,
  });
}
