import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  companyMemberErrorStatus,
  isCompanyMemberError,
} from "@/lib/companies";
import { notifyCompanyMemberLeft, notifyCompanyMemberRemoved } from "@/lib/db/companies";
import { createClient } from "@/lib/supabase/server";
import {
  routeCompanyMemberSchema,
  updateCompanyMemberSchema,
} from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

type Params = { params: Promise<{ id: string; memberId: string }> };

/**
 * The member id alone identifies the row; the company id in the path must
 * match it, so a request can't act on another company through this URL.
 */
async function memberBelongsToCompany(
  supabase: SupabaseClient,
  companyId: string,
  memberId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("id", memberId)
    .maybeSingle();

  return (data as { company_id?: string } | null)?.company_id === companyId;
}

function refusal(status: string | undefined) {
  const code = isCompanyMemberError(status) ? status : "forbidden";
  return NextResponse.json(
    { error: "Not allowed", code },
    { status: companyMemberErrorStatus(code) },
  );
}

type Resolved =
  | { ok: true; supabase: SupabaseClient; userId: string; route: { id: string; memberId: string } }
  | { ok: false; response: NextResponse };

async function resolve(params: Params["params"]): Promise<Resolved> {
  const route = routeCompanyMemberSchema.safeParse(await params);

  if (!route.success) {
    return { ok: false, response: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 },
      ),
    };
  }

  if (!(await memberBelongsToCompany(supabase, route.data.id, route.data.memberId))) {
    return { ok: false, response: refusal("not_found") };
  }

  return { ok: true, supabase, userId: user.id, route: route.data };
}

/** PATCH /api/companies/:id/members/:memberId — change a role (owners only). */
export async function PATCH(request: Request, { params }: Params) {
  const resolved = await resolve(params);
  if (!resolved.ok) {
    return resolved.response;
  }

  const parsed = await parseJsonRequest(request, updateCompanyMemberSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid_role" }, { status: 400 });
  }

  const { data, error } = await resolved.supabase.rpc("set_company_member_role", {
    p_member_id: resolved.route.memberId,
    p_role: parsed.data.role,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = (data ?? {}) as { status?: string };
  return result.status === "ok" ? NextResponse.json({ success: true }) : refusal(result.status);
}

/**
 * DELETE /api/companies/:id/members/:memberId — remove someone, cancel an
 * invitation, or leave the team yourself.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const resolved = await resolve(params);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { data, error } = await resolved.supabase.rpc("remove_company_member", {
    p_member_id: resolved.route.memberId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = (data ?? {}) as {
    status?: string;
    user_id?: string;
    was_member?: boolean;
    left?: boolean;
  };

  if (result.status !== "ok") {
    return refusal(result.status);
  }

  // A cancelled invitation needs no message.
  if (result.was_member && result.user_id) {
    if (result.left) {
      await notifyCompanyMemberLeft({ companyId: resolved.route.id, userId: result.user_id });
    } else {
      await notifyCompanyMemberRemoved({
        companyId: resolved.route.id,
        userId: result.user_id,
        actorUserId: resolved.userId,
      });
    }
  }

  return NextResponse.json({ success: true });
}
