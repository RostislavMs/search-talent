import { NextResponse } from "next/server";
import { z } from "zod";
import { setPlatformAdmin } from "@/lib/db/moderation-actions";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const routeSchema = z.object({
  id: z.string().uuid("Invalid user id"),
});

/**
 * POST grants, DELETE takes back the admin role. set_platform_admin() decides
 * with the admin's own session (not one's own role, never the last admin) and
 * every change goes into the moderation log.
 */
async function changeRole(params: Promise<{ id: string }>, admin: boolean) {
  const parsedParams = routeSchema.safeParse(await params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: parsedParams.error.issues[0]?.message || "Invalid user id" },
      { status: 400 },
    );
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await setPlatformAdmin(context.supabase, parsedParams.data.id, admin);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return changeRole(params, true);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return changeRole(params, false);
}
