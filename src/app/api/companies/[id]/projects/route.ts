import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyCompanyProjectRequest } from "@/lib/db/companies";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { routeCompanyIdSchema } from "@/lib/validation/companies";
import { parseJsonRequest } from "@/lib/validation/request";

const bodySchema = z.object({ projectId: z.string().uuid("Invalid project id") });

/**
 * POST /api/companies/:id/projects — the author puts one of their own
 * published projects on a company page. For a team member it is shown at
 * once; for anyone else (a freelancer and their client) it becomes a request
 * the company accepts or turns down.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeCompanyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await dbRateLimit(`company-project:${user.id}`, 60, 60 * 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, bodySchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("owner_id, status, moderation_status")
    .eq("id", parsed.data.projectId)
    .maybeSingle();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: "Not your project", code: "forbidden" }, { status: 403 });
  }

  // Drafts would sit on the page invisibly; ask to publish first.
  if (project.status !== "published" || project.moderation_status !== "approved") {
    return NextResponse.json({ error: "Publish the project first", code: "not_published" }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("company_projects")
    .insert({
      company_id: route.data.id,
      project_id: parsed.data.projectId,
      added_by: user.id,
    })
    .select("status")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already added", code: "already_added" }, { status: 409 });
    }
    if (error.message?.includes("company_projects_limit_reached")) {
      return NextResponse.json({ error: "Too many projects", code: "limit" }, { status: 409 });
    }
    if (error.message?.includes("project_companies_limit_reached")) {
      return NextResponse.json({ error: "Too many companies", code: "project_limit" }, { status: 409 });
    }
    // The policy refused: the page is not visible to the caller.
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  // The database decides: a team member's project is shown at once, anyone
  // else's waits for the company, which is told about it.
  const status = (inserted as { status?: string } | null)?.status === "pending" ? "pending" : "approved";
  if (status === "pending") {
    await notifyCompanyProjectRequest({
      companyId: route.data.id,
      projectId: parsed.data.projectId,
      actorUserId: user.id,
    });
  }

  return NextResponse.json({ status }, { status: 201 });
}
