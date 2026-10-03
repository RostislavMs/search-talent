import { NextResponse } from "next/server";
import { APPLY_REFUSAL_HTTP_STATUS, toApplyRefusal } from "@/lib/applications";
import { notifyApplicationReceived } from "@/lib/db/applications";
import { createClient } from "@/lib/supabase/server";
import { applyToVacancySchema } from "@/lib/validation/applications";
import { parseJsonRequest } from "@/lib/validation/request";
import { routeVacancyIdSchema } from "@/lib/validation/vacancies";

/**
 * POST /api/vacancies/:id/applications — the candidate applies with 1–3 of
 * their projects and a message, having agreed to hand the company their
 * contacts. apply_to_vacancy() decides everything else: the vacancy is open,
 * the person is not in its team, has a public profile and a confirmed email,
 * the projects are theirs, once per vacancy, 20 a day.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeVacancyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid vacancy id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, applyToVacancySchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("apply_to_vacancy", {
    p_vacancy_id: route.data.id,
    p_message: parsed.data.message,
    p_project_ids: parsed.data.project_ids,
  });

  if (error) {
    console.error("[applications] apply failed:", error.message);
    return NextResponse.json({ error: "Could not send the application", code: "failed" }, { status: 500 });
  }

  const result = (data ?? {}) as { status?: string; application_id?: string };

  if (result.status !== "ok" || !result.application_id) {
    const code = toApplyRefusal(result.status);
    return NextResponse.json(
      { error: "The application was not accepted", code },
      { status: APPLY_REFUSAL_HTTP_STATUS[code] },
    );
  }

  await notifyApplicationReceived({
    applicationId: result.application_id,
    vacancyId: route.data.id,
    applicantUserId: user.id,
  });

  return NextResponse.json({ application: { id: result.application_id } }, { status: 201 });
}
