import { NextResponse } from "next/server";
import {
  companyMemberErrorStatus,
  isCompanyMemberError,
} from "@/lib/companies";
import { notifyCompanyInvite } from "@/lib/db/companies";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  inviteCompanyMemberSchema,
  routeCompanyIdSchema,
} from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/companies/:id/members — invite someone to the team. Who may invite
 * whom is decided by invite_company_member(); this route adds the rate limit
 * and the notification.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, inviteCompanyMemberSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid_role" }, { status: 400 });
  }

  // Invitations land in other people's notifications: cap them like comments.
  const limited = await dbRateLimit(`company-invite:${user.id}`, 20, 60 * 60_000);
  if (limited) {
    return limited;
  }

  const { data, error } = await supabase.rpc("invite_company_member", {
    p_company_id: route.data.id,
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = (data ?? {}) as { status?: string; member_id?: string };

  if (result.status !== "ok" || !result.member_id) {
    const code = isCompanyMemberError(result.status) ? result.status : "forbidden";
    return NextResponse.json(
      { error: "Could not invite", code },
      { status: companyMemberErrorStatus(code) },
    );
  }

  await notifyCompanyInvite({
    companyId: route.data.id,
    memberId: result.member_id,
    inviteeUserId: parsed.data.userId,
    actorUserId: user.id,
    role: parsed.data.role,
  });

  return NextResponse.json({ memberId: result.member_id }, { status: 201 });
}
