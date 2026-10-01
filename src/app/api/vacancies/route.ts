import { NextResponse } from "next/server";
import { getCompanyRole } from "@/lib/db/companies";
import { setVacancySkills, vacancyPayloadToRow } from "@/lib/db/vacancies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { dbRateLimit } from "@/lib/rate-limit";
import { buildVacancySlug } from "@/lib/vacancies";
import { createVacancySchema, vacancyReadinessIssues } from "@/lib/validation/vacancies";
import { parseJsonRequest } from "@/lib/validation/request";
import {
  sanitizeVacancyDescription,
  screenVacancy,
  vacancyWriteErrorResponse,
} from "./shared";

/**
 * POST /api/vacancies — a company's team member writes a vacancy, as a draft
 * or straight out. The database stamps the dates, caps a company at 5 new
 * vacancies a day and sends an unverified company's vacancy to a moderator;
 * text that trips auto-moderation is held here.
 */
export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The insert policy checks this too; asking here gives a clear answer.
  if (!context.user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Confirm your email first", code: "email_unconfirmed" },
      { status: 403 },
    );
  }

  const parsed = await parseJsonRequest(request, createVacancySchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const payload = parsed.data;
  const role = await getCompanyRole(context.supabase, payload.company_id, context.user.id);

  if (!role && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const limited = await dbRateLimit(`create-vacancy:${context.user.id}`, 10, 60 * 60_000);
  if (limited) {
    return limited;
  }

  const description = sanitizeVacancyDescription(payload.description);

  if (!description.ok) {
    return NextResponse.json(
      { error: "Description is too long", code: "description_long" },
      { status: 400 },
    );
  }

  if (payload.status === "published") {
    const issues = vacancyReadinessIssues({ ...payload, description: description.html });
    if (issues.length > 0) {
      return NextResponse.json(
        { error: "The vacancy is not ready to go out", code: issues[0], issues },
        { status: 400 },
      );
    }
  }

  const row = {
    ...vacancyPayloadToRow(payload, description.html),
    company_id: payload.company_id,
    author_user_id: context.user.id,
    status: payload.status,
  };

  // The address is the title plus a random tail; a clash only means another
  // roll.
  let result = await context.supabase
    .from("vacancies")
    .insert({ ...row, slug: buildVacancySlug(payload.title) })
    .select("id, slug, status, moderation_status")
    .single();

  if (result.error?.code === "23505") {
    result = await context.supabase
      .from("vacancies")
      .insert({ ...row, slug: buildVacancySlug(payload.title) })
      .select("id, slug, status, moderation_status")
      .single();
  }

  const { data, error } = result;

  if (error || !data) {
    return vacancyWriteErrorResponse(error, "Could not create the vacancy");
  }

  const vacancy = data as { id: string; slug: string; status: string; moderation_status: string };
  const skillsError = await setVacancySkills(context.supabase, vacancy.id, payload.skill_ids);

  if (skillsError) {
    // A vacancy without the skills it was saved with is not what the author
    // wrote; take it back rather than leave half of it.
    await context.supabase.from("vacancies").delete().eq("id", vacancy.id);
    return vacancyWriteErrorResponse(skillsError, "Could not save the skills");
  }

  const heldForReview =
    vacancy.status !== "draft"
      ? await screenVacancy(vacancy.id, {
          title: payload.title,
          description: description.html,
          city: payload.city,
        })
      : false;

  return NextResponse.json(
    {
      vacancy: { id: vacancy.id, slug: vacancy.slug },
      heldForReview,
      moderationStatus: heldForReview ? "under_review" : vacancy.moderation_status,
    },
    { status: 201 },
  );
}
