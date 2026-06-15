import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const routeSchema = z.object({
  id: z.string().uuid("Invalid user id"),
});

async function requireAdminContext() {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!context.isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, context };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = routeSchema.safeParse(await params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: parsedParams.error.issues[0]?.message || "Invalid user id" },
      { status: 400 },
    );
  }

  const gate = await requireAdminContext();
  if (!gate.ok) return gate.response;

  const { context } = gate;
  const { id: targetUserId } = parsedParams.data;

  if (targetUserId === context.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own admin role" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 500 },
    );
  }

  const { error } = await adminClient
    .from("platform_admins")
    .upsert(
      { user_id: targetUserId },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not grant admin role" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = routeSchema.safeParse(await params);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: parsedParams.error.issues[0]?.message || "Invalid user id" },
      { status: 400 },
    );
  }

  const gate = await requireAdminContext();
  if (!gate.ok) return gate.response;

  const { context } = gate;
  const { id: targetUserId } = parsedParams.data;

  if (targetUserId === context.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own admin role" },
      { status: 400 },
    );
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 500 },
    );
  }

  const { error } = await adminClient
    .from("platform_admins")
    .delete()
    .eq("user_id", targetUserId);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not revoke admin role" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
