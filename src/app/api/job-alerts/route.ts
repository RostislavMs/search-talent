import { NextResponse } from "next/server";
import { createJobAlert, nameJobAlert } from "@/lib/db/job-alerts";
import { defaultLocale } from "@/lib/i18n/config";
import { readJobAlertFilters, type JobAlertTarget } from "@/lib/job-alerts";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createJobAlertSchema } from "@/lib/validation/job-alerts";
import { parseJsonRequest } from "@/lib/validation/request";

const REFUSAL_HTTP_STATUS = {
  duplicate: 409,
  limit: 409,
  invalid: 400,
  unavailable: 503,
} as const;

/**
 * POST /api/job-alerts — follow a search of /jobs, or switch on "vacancies
 * that fit me". New matches arrive every morning as a notification and, with
 * notifyEmail (on unless turned off), by email.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const limited = await dbRateLimit(`job-alerts:${user.id}`, 30, 60 * 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, createJobAlertSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const payload = parsed.data;
  const locale = payload.locale ?? defaultLocale;
  const target: JobAlertTarget =
    "match" in payload ? { type: "profile" } : { type: "filters", filters: readJobAlertFilters(payload.filters) };

  const result = await createJobAlert(supabase, user.id, {
    target,
    name: await nameJobAlert(supabase, target, locale),
    notifyEmail: payload.notifyEmail ?? true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "The alert was not saved", code: result.code },
      { status: REFUSAL_HTTP_STATUS[result.code] },
    );
  }

  return NextResponse.json({ alert: result.alert }, { status: 201 });
}
