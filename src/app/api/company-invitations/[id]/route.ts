import { NextResponse } from "next/server";
import { notifyCompanyInviteResponse } from "@/lib/db/companies";
import { createClient } from "@/lib/supabase/server";
import {
  respondCompanyInvitationSchema,
  routeCompanyInvitationSchema,
} from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * PATCH /api/company-invitations/:id — accept or decline an invitation to a
 * company team. respond_company_invite() checks that it is the caller's own,
 * still-open invitation.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = routeCompanyInvitationSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, respondCompanyInvitationSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const accept = parsed.data.action === "accept";
  const { data, error } = await supabase.rpc("respond_company_invite", {
    p_member_id: route.data.id,
    p_accept: accept,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = (data ?? {}) as {
    status?: string;
    company_id?: string;
    invited_by?: string | null;
  };

  if (result.status === "membership_limit") {
    return NextResponse.json(
      { error: "Already in the most companies one can be in", code: "membership_limit" },
      { status: 409 },
    );
  }

  if (result.status !== "ok" || !result.company_id) {
    return NextResponse.json(
      { error: "Invitation not found or already answered", code: "not_found" },
      { status: 404 },
    );
  }

  await notifyCompanyInviteResponse({
    companyId: result.company_id,
    inviterUserId: result.invited_by ?? null,
    actorUserId: user.id,
    accepted: accept,
  });

  return NextResponse.json({ status: accept ? "accepted" : "declined" });
}
