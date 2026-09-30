import { NextResponse } from "next/server";
import { canEditCompany } from "@/lib/companies";
import { deleteCompanyLogo, getCompanyRole, isCompanyLogoUrl } from "@/lib/db/companies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { companyLogoSchema, routeCompanyIdSchema } from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

type Params = { params: Promise<{ id: string }> };

type Authorized =
  | { ok: true; context: Awaited<ReturnType<typeof getCurrentViewerRole>>; id: string }
  | { ok: false; response: NextResponse };

async function authorize(params: Params["params"]): Promise<Authorized> {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return { ok: false, response: NextResponse.json({ error: "Invalid company id" }, { status: 400 }) };
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = await getCompanyRole(context.supabase, route.data.id, context.user.id);

  if (!canEditCompany(role) && !context.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, context, id: route.data.id };
}

/**
 * PUT /api/companies/:id/logo — save the logo that was just uploaded. Only the
 * company's own storage key is accepted (see buildCompanyLogoKey), so a page
 * cannot show a file from somewhere else.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await authorize(params);
  if (!auth.ok) {
    return auth.response;
  }

  const parsed = await parseJsonRequest(request, companyLogoSchema);

  if (!parsed.success || !isCompanyLogoUrl(parsed.data.logoUrl, auth.id)) {
    return NextResponse.json({ error: "Invalid logo" }, { status: 400 });
  }

  const { data, error } = await auth.context.supabase
    .from("companies")
    .update({ logo_url: parsed.data.logoUrl })
    .eq("id", auth.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({ logoUrl: parsed.data.logoUrl });
}

/** DELETE /api/companies/:id/logo — back to the first-letter tile. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await authorize(params);
  if (!auth.ok) {
    return auth.response;
  }

  const { data, error } = await auth.context.supabase
    .from("companies")
    .update({ logo_url: null })
    .eq("id", auth.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  await deleteCompanyLogo(auth.id);

  return NextResponse.json({ logoUrl: null });
}
