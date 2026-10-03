import { NextResponse } from "next/server";
import { applicantNoticeFor, normalizeApplicationStatus } from "@/lib/applications";
import { notifyApplicationStatus } from "@/lib/db/applications";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  applicationStatusSchema,
  routeApplicationIdSchema,
} from "@/lib/validation/applications";
import { parseJsonRequest } from "@/lib/validation/request";

const REFUSAL_HTTP_STATUS: Record<string, number> = {
  unauthorized: 401,
  invalid_status: 400,
  not_found: 404,
  withdrawn: 409,
};

/**
 * PATCH /api/applications/:id — any member of the company's team moves an
 * application: viewed, shortlisted, rejected or hired. The candidate hears
 * about decisions (see applicantNoticeFor).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeApplicationIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, applicationStatusSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid_status" }, { status: 400 });
  }

  // Every decision reaches the candidate, decisions by email: flipping one
  // application back and forth must not fill their inbox.
  const limited = await dbRateLimit(`application-status:${route.data.id}`, 10, 60 * 60_000);
  if (limited) {
    return limited;
  }

  const { data, error } = await supabase.rpc("set_vacancy_application_status", {
    p_application_id: route.data.id,
    p_status: parsed.data.status,
  });

  if (error) {
    console.error("[applications] status change failed:", error.message);
    return NextResponse.json({ error: "Could not change the application", code: "failed" }, { status: 500 });
  }

  const result = (data ?? {}) as {
    status?: string;
    changed?: boolean;
    previous_status?: string;
    applicant_user_id?: string;
    vacancy_id?: string;
  };

  if (result.status !== "ok") {
    const code = result.status && result.status in REFUSAL_HTTP_STATUS ? result.status : "not_found";
    return NextResponse.json(
      { error: "The application was not changed", code },
      { status: REFUSAL_HTTP_STATUS[code] },
    );
  }

  const notice = result.changed
    ? applicantNoticeFor(normalizeApplicationStatus(result.previous_status), parsed.data.status)
    : null;

  if (notice && result.applicant_user_id && result.vacancy_id) {
    await notifyApplicationStatus({
      applicationId: route.data.id,
      vacancyId: result.vacancy_id,
      applicantUserId: result.applicant_user_id,
      notice,
    });
  }

  return NextResponse.json({
    application: { id: route.data.id, status: parsed.data.status },
    changed: Boolean(result.changed),
  });
}
