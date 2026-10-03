import { NextResponse } from "next/server";
import { notifyApplicationsViewed } from "@/lib/db/applications";
import { createClient } from "@/lib/supabase/server";
import { markApplicationsViewedSchema } from "@/lib/validation/applications";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/applications/viewed — the team's list was opened: the new
 * applications on screen become "viewed", and each of those candidates hears
 * that the company looked. Sent from the page once it is shown, not while it
 * renders, so a prefetch does not count as a look.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, markApplicationsViewedSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("mark_vacancy_applications_viewed", {
    p_application_ids: parsed.data.ids,
  });

  if (error) {
    console.error("[applications] mark viewed failed:", error.message);
    return NextResponse.json({ error: "Could not update the applications" }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    application_id: string;
    applicant_user_id: string;
    vacancy_id: string;
  }>;

  await notifyApplicationsViewed(rows);

  return NextResponse.json({ viewed: rows.length });
}
