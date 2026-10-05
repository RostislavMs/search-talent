import { NextResponse } from "next/server";
import { screenContentForModeration } from "@/lib/auto-moderation";
import { canDeleteCompany, canEditCompany } from "@/lib/companies";
import {
  companyPayloadToRow,
  companyWriteErrorCode,
  getCompanyRole,
  holdCompanyForReview,
} from "@/lib/db/companies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { companyPayloadSchema, routeCompanyIdSchema } from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

const WRITE_ERROR_STATUS = {
  slug_taken: 409,
  limit: 409,
  membership_limit: 409,
  email_unconfirmed: 403,
  invalid: 400,
} as const;

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/companies/:id — owners and admins edit the page. The database
 * keeps the check mark and moderation out of their reach, and takes the mark
 * off when the name or website changes; the answer says when that happened.
 */
export async function PATCH(request: Request, { params }: Params) {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const { id } = route.data;
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getCompanyRole(context.supabase, id, context.user.id);

  if (!canEditCompany(role) && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, companyPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const payload = parsed.data;

  const { data: before } = await context.supabase
    .from("companies")
    .select("id, verified_at")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const { data, error } = await context.supabase
    .from("companies")
    .update(companyPayloadToRow(payload))
    .eq("id", id)
    .select("id, slug, verified_at")
    .maybeSingle();

  if (error) {
    const code = companyWriteErrorCode(error) ?? "invalid";
    return NextResponse.json(
      { error: error.message || "Could not save the company", code },
      { status: WRITE_ERROR_STATUS[code] },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const screen = screenContentForModeration([payload.name, payload.description, payload.city]);
  const heldForReview = screen.flagged ? await holdCompanyForReview(id, screen.note) : false;

  return NextResponse.json({
    company: { id: data.id, slug: data.slug },
    heldForReview,
    verificationLost: Boolean(before.verified_at) && !data.verified_at,
  });
}

/** DELETE /api/companies/:id — only an owner (or a platform admin). */
export async function DELETE(_request: Request, { params }: Params) {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const { id } = route.data;
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getCompanyRole(context.supabase, id, context.user.id);

  if (!canDeleteCompany(role) && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const { data, error } = await context.supabase
    .from("companies")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not delete the company" },
      { status: 400 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // The page, its team and vacancies wait 60 days in the trash (a database
  // trigger); the logo is deleted from storage when the trash is emptied.
  return NextResponse.json({ success: true });
}
