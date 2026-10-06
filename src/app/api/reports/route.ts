import { NextResponse } from "next/server";
import { submitReport } from "@/lib/db/moderation-actions";
import { createClient } from "@/lib/supabase/server";
import { reportPayloadSchema } from "@/lib/validation/report";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/reports — a signed-in person reports a profile, project, article,
 * poll, comment, company page or vacancy. submit_report() does the rest: owner
 * and priority, one's own content and hidden targets refused, no duplicates,
 * at most 5 a minute, and an urgent report holds the target for a moderator.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, reportPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await submitReport(supabase, parsed.data);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
