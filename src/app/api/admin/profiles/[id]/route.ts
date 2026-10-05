import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount } from "@/lib/db/trash";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const routeSchema = z.object({
  id: z.string().uuid("Invalid profile id"),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid profile id" },
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

  const { id } = routeParams.data;

  const { data: profile, error: profileError } = await context.supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.user_id === context.user.id) {
    return NextResponse.json(
      { error: "Admins cannot delete their own profile from here" },
      { status: 400 },
    );
  }

  // Blocking sign-in needs the Auth admin API, so without the service key
  // nothing is deleted at all.
  if (!createAdminClient()) {
    return NextResponse.json(
      { error: "Admin client is not configured" },
      { status: 500 },
    );
  }

  // Into the trash for 60 days, like a self-deletion; the database checks
  // that the caller is an admin removing someone else.
  const result = await deleteAccount(context.supabase, profile.user_id, "erase");

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code === "already_deleted" ? "already_deleted" : "Could not delete user account" },
      { status: result.code === "forbidden" ? 403 : result.code === "already_deleted" ? 409 : 400 },
    );
  }

  return NextResponse.json({ success: true });
}
