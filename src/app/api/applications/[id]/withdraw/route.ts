import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeApplicationIdSchema } from "@/lib/validation/applications";

/**
 * POST /api/applications/:id/withdraw — the candidate takes their application
 * back. The company keeps only the fact that it was withdrawn: the message,
 * the projects and the contacts are no longer theirs to see. Withdrawing
 * twice is not an error.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeApplicationIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("withdraw_vacancy_application", {
    p_application_id: route.data.id,
  });

  if (error) {
    console.error("[applications] withdraw failed:", error.message);
    return NextResponse.json({ error: "Could not withdraw the application" }, { status: 500 });
  }

  const status = (data as { status?: string } | null)?.status;

  if (status !== "ok" && status !== "already_withdrawn") {
    return NextResponse.json({ error: "Application not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ application: { id: route.data.id, status: "withdrawn" } });
}
