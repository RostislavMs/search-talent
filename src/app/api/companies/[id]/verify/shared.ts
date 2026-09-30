import "server-only";

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { canEditCompany, type CompanyDetails } from "@/lib/companies";
import { getCompanyById, getCompanyRole } from "@/lib/db/companies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { dbRateLimit } from "@/lib/rate-limit";
import { routeCompanyIdSchema } from "@/lib/validation/companies";

export type VerifyContext =
  | { ok: true; user: User; company: CompanyDetails }
  | { ok: false; response: NextResponse };

/**
 * What both verification routes check first: a signed-in owner or admin of a
 * page that exists, within the rate limit. `limitKey` keeps sending codes and
 * trying them on separate budgets.
 */
export async function resolveVerifyContext(
  params: Promise<{ id: string }>,
  limit: { key: string; max: number },
): Promise<VerifyContext> {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return { ok: false, response: NextResponse.json({ error: "Invalid company id" }, { status: 400 }) };
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const limited = await dbRateLimit(`${limit.key}:${context.user.id}`, limit.max, 60 * 60_000);
  if (limited) {
    return { ok: false, response: limited };
  }

  const company = await getCompanyById(context.supabase, route.data.id);

  if (!company) {
    return { ok: false, response: NextResponse.json({ error: "Company not found" }, { status: 404 }) };
  }

  const role = await getCompanyRole(context.supabase, company.id, context.user.id);

  if (!canEditCompany(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user: context.user, company };
}
