import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyCompanyProjectDecision } from "@/lib/db/companies";
import { createClient } from "@/lib/supabase/server";

const routeSchema = z.object({
  id: z.string().uuid("Invalid company id"),
  projectId: z.string().uuid("Invalid project id"),
});

type Params = { params: Promise<{ id: string; projectId: string }> };

async function resolve(params: Params["params"]) {
  const route = routeSchema.safeParse(await params);

  if (!route.success) {
    return { ok: false as const, response: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true as const, supabase, userId: user.id, route: route.data };
}

/**
 * POST /api/companies/:id/projects/:projectId — an owner or admin confirms a
 * project on their page, or accepts an outside author's request (which
 * confirms it too). confirm_company_project() checks the rights and refuses
 * confirming one's own project.
 */
export async function POST(_request: Request, { params }: Params) {
  const resolved = await resolve(params);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { data, error } = await resolved.supabase.rpc("confirm_company_project", {
    p_company_id: resolved.route.id,
    p_project_id: resolved.route.projectId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const result = (data ?? {}) as { status?: string };

  if (result.status !== "ok") {
    const code = result.status ?? "forbidden";
    const status = code === "not_found" ? 404 : code === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: "Not allowed", code }, { status });
  }

  await notifyCompanyProjectDecision({
    companyId: resolved.route.id,
    projectId: resolved.route.projectId,
    actorUserId: resolved.userId,
    confirmed: true,
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/companies/:id/projects/:projectId — take a project off the page.
 * Its author can always do it (also after leaving the team); the company's
 * owners and admins can take off any project, and turn down a request. The
 * delete policy decides. A turned-down request is reported to its author.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const resolved = await resolve(params);
  if (!resolved.ok) {
    return resolved.response;
  }

  const { supabase, route, userId } = resolved;

  const { data: link } = await supabase
    .from("company_projects")
    .select("status, project:project_id ( owner_id )")
    .eq("company_id", route.id)
    .eq("project_id", route.projectId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("company_projects")
    .delete()
    .eq("company_id", route.id)
    .eq("project_id", route.projectId)
    .select("project_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not found or not allowed", code: "not_found" }, { status: 404 });
  }

  const row = link as {
    status?: string;
    project?: { owner_id?: string } | Array<{ owner_id?: string }> | null;
  } | null;
  const project = Array.isArray(row?.project) ? row?.project[0] : row?.project;

  if (row?.status === "pending" && project?.owner_id && project.owner_id !== userId) {
    await notifyCompanyProjectDecision({
      companyId: route.id,
      projectId: route.projectId,
      actorUserId: userId,
      confirmed: false,
    });
  }

  return NextResponse.json({ success: true });
}
