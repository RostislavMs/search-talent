import { NextResponse } from "next/server";
import { getCompanyRole } from "@/lib/db/companies";
import { setVacancySkills, vacancyPayloadToRow } from "@/lib/db/vacancies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  routeVacancyIdSchema,
  vacancyPayloadSchema,
  vacancyReadinessIssues,
} from "@/lib/validation/vacancies";
import { parseJsonRequest } from "@/lib/validation/request";
import {
  sanitizeVacancyDescription,
  screenVacancy,
  vacancyWriteErrorResponse,
} from "../shared";

type Params = { params: Promise<{ id: string }> };

type ExistingVacancy = {
  id: string;
  company_id: string;
  status: string;
};

/**
 * PATCH /api/vacancies/:id — the company's team edits a vacancy. A draft may
 * go out with the same save ("Publish"); a vacancy that is already out keeps
 * its status (closing and extending have their own route) and has to stay
 * complete. The database sends an unverified company's changed text back to
 * a moderator.
 */
export async function PATCH(request: Request, { params }: Params) {
  const route = routeVacancyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid vacancy id" }, { status: 400 });
  }

  const { id } = route.data;
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existingData } = await context.supabase
    .from("vacancies")
    .select("id, company_id, status")
    .eq("id", id)
    .maybeSingle();
  const existing = existingData as ExistingVacancy | null;

  if (!existing) {
    return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
  }

  const role = await getCompanyRole(context.supabase, existing.company_id, context.user.id);

  if (!role && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, vacancyPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const payload = parsed.data;
  const description = sanitizeVacancyDescription(payload.description);

  if (!description.ok) {
    return NextResponse.json(
      { error: "Description is too long", code: "description_long" },
      { status: 400 },
    );
  }

  const isDraft = existing.status === "draft";
  const nextStatus = isDraft ? payload.status : existing.status;

  if (nextStatus !== "draft") {
    const issues = vacancyReadinessIssues({ ...payload, description: description.html });
    if (issues.length > 0) {
      return NextResponse.json(
        { error: "The vacancy is not ready to go out", code: issues[0], issues },
        { status: 400 },
      );
    }
  }

  const { data, error } = await context.supabase
    .from("vacancies")
    .update({
      ...vacancyPayloadToRow(payload, description.html),
      ...(isDraft ? { status: payload.status } : {}),
    })
    .eq("id", id)
    .select("id, slug, status, moderation_status")
    .maybeSingle();

  if (error) {
    return vacancyWriteErrorResponse(error, "Could not save the vacancy");
  }

  if (!data) {
    return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
  }

  const saved = data as { id: string; slug: string; status: string; moderation_status: string };
  const skillsError = await setVacancySkills(context.supabase, id, payload.skill_ids);

  if (skillsError) {
    return vacancyWriteErrorResponse(skillsError, "Could not save the skills");
  }

  // A vacancy waiting for a moderator is screened too: the note tells the
  // moderator what tripped. A stricter decision is left alone.
  const heldForReview =
    saved.status !== "draft" &&
    (saved.moderation_status === "approved" || saved.moderation_status === "under_review")
      ? await screenVacancy(id, {
          title: payload.title,
          description: description.html,
          city: payload.city,
        })
      : false;

  return NextResponse.json({
    vacancy: { id: saved.id, slug: saved.slug, status: saved.status },
    heldForReview,
    moderationStatus: heldForReview ? "under_review" : saved.moderation_status,
  });
}

/**
 * DELETE /api/vacancies/:id — its author, or an owner or admin of the company
 * (or a platform admin). RLS decides; nothing deleted means not allowed or
 * gone.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const route = routeVacancyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid vacancy id" }, { status: 400 });
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await context.supabase
    .from("vacancies")
    .delete()
    .eq("id", route.data.id)
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not delete the vacancy" },
      { status: 400 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Vacancy not found", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
