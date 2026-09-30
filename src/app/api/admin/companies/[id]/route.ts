import { NextResponse } from "next/server";
import { notifyCompanyModeration, notifyCompanyVerified } from "@/lib/db/companies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  adminCompanyUpdateSchema,
  routeCompanyIdSchema,
} from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * PATCH /api/admin/companies/:id — a platform admin confirms or takes back the
 * check mark and sets the moderation status. Runs with the admin's own session:
 * RLS and guard_company_columns let admins through.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, adminCompanyUpdateSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = route.data;
  const { data: before } = await context.supabase
    .from("companies")
    .select("id, verified_at, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (parsed.data.verified === true && !before.verified_at) {
    patch.verified_at = now;
    patch.verification_method = "admin";
    patch.verified_by = context.user.id;
  } else if (parsed.data.verified === false) {
    patch.verified_at = null;
    patch.verification_method = null;
    patch.verified_by = null;
  }

  if (parsed.data.moderation_status) {
    patch.moderation_status = parsed.data.moderation_status;
    patch.moderation_note = parsed.data.moderation_note;
    patch.moderated_at = now;
    patch.moderated_by = context.user.id;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await context.supabase.from("companies").update(patch).eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not update the company" },
      { status: 400 },
    );
  }

  if (patch.verified_at) {
    await notifyCompanyVerified({ companyId: id });
  }

  const status = parsed.data.moderation_status;
  if ((status === "removed" || status === "restricted") && status !== before.moderation_status) {
    await notifyCompanyModeration({ companyId: id, status });
  }

  return NextResponse.json({ success: true });
}
