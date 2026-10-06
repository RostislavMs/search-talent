import { NextResponse } from "next/server";
import { getCompanyRole } from "@/lib/db/companies";
import { saveVacancy, vacancyPayloadToRow } from "@/lib/db/vacancies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  routeVacancyIdSchema,
  vacancyPayloadSchema,
  vacancyReadinessIssues,
} from "@/lib/validation/vacancies";
import { parseJsonRequest } from "@/lib/validation/request";
import { isAutoModerationNote } from "@/lib/auto-moderation";
import { sanitizeVacancyDescription, vacancyWriteErrorResponse } from "../shared";

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

  // The text and the skills in one transaction.
  const { vacancy: saved, error } = await saveVacancy(
    context.supabase,
    id,
    {
      ...vacancyPayloadToRow(payload, description.html),
      ...(isDraft ? { status: payload.status } : {}),
    },
    payload.skill_ids,
  );

  if (!saved) {
    if (error?.code === "P0002") {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }
    return vacancyWriteErrorResponse(error, "Could not save the vacancy");
  }

  // The database screened the text: a vacancy out (or waiting for a
  // moderator) with a flagged text waits, with a note that says why.
  const heldForReview =
    saved.moderation_status === "under_review" && isAutoModerationNote(saved.moderation_note);

  return NextResponse.json({
    vacancy: { id: saved.id, slug: saved.slug, status: saved.status },
    heldForReview,
    moderationStatus: saved.moderation_status,
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
