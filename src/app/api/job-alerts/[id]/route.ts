import { NextResponse } from "next/server";
import { deleteJobAlert, setJobAlertEmail } from "@/lib/db/job-alerts";
import { createClient } from "@/lib/supabase/server";
import { routeJobAlertIdSchema, updateJobAlertSchema } from "@/lib/validation/job-alerts";
import { parseJsonRequest } from "@/lib/validation/request";

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** PATCH /api/job-alerts/:id — switch the morning email on or off. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeJobAlertIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid alert id", code: "invalid" }, { status: 400 });
  }

  const { supabase, user } = await signedIn();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, updateJobAlertSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const updated = await setJobAlertEmail(supabase, user.id, route.data.id, parsed.data.notifyEmail);

  if (!updated) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ alert: { id: route.data.id, notifyEmail: parsed.data.notifyEmail } });
}

/** DELETE /api/job-alerts/:id — stop following. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeJobAlertIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid alert id", code: "invalid" }, { status: 400 });
  }

  const { supabase, user } = await signedIn();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
  }

  const deleted = await deleteJobAlert(supabase, user.id, route.data.id);

  if (!deleted) {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
