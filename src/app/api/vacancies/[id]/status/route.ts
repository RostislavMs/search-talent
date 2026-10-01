import { NextResponse } from "next/server";
import { getCompanyRole } from "@/lib/db/companies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  normalizeVacancyKind,
  normalizeVacancyStatus,
  resolveVacancyState,
  toVacancyPay,
} from "@/lib/vacancies";
import {
  routeVacancyIdSchema,
  vacancyReadinessIssues,
  vacancyStatusActionSchema,
} from "@/lib/validation/vacancies";
import { parseJsonRequest } from "@/lib/validation/request";
import { screenVacancy, vacancyWriteErrorResponse } from "../../shared";

type StoredVacancy = {
  id: string;
  company_id: string;
  status: string;
  expires_at: string | null;
  moderation_status: string;
  title: string;
  description: string | null;
  city: string | null;
  kind: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
};

/**
 * POST /api/vacancies/:id/status — any member of the company's team:
 *   publish — a draft goes out (it has to be complete);
 *   close   — an open vacancy comes down;
 *   extend  — 60 days from now, for an open, expired or closed vacancy.
 * The database writes the dates: whatever expires_at is sent, it becomes
 * "60 days from now".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const route = routeVacancyIdSchema.safeParse(await params);

  if (!route.success) {
    return NextResponse.json({ error: "Invalid vacancy id" }, { status: 400 });
  }

  const { id } = route.data;
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, vacancyStatusActionSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error, code: "invalid" }, { status: 400 });
  }

  const { data: storedData } = await context.supabase
    .from("vacancies")
    .select(
      "id, company_id, status, expires_at, moderation_status, title, description, city, kind, pay_min, pay_max, pay_currency, pay_period",
    )
    .eq("id", id)
    .maybeSingle();
  const stored = storedData as StoredVacancy | null;

  if (!stored) {
    return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
  }

  const role = await getCompanyRole(context.supabase, stored.company_id, context.user.id);

  if (!role && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const status = normalizeVacancyStatus(stored.status);
  const state = resolveVacancyState({ status, expiresAt: stored.expires_at });
  const { action } = parsed.data;

  let patch: Record<string, unknown>;

  if (action === "publish") {
    if (status !== "draft") {
      return NextResponse.json({ error: "Already out", code: "invalid_status" }, { status: 409 });
    }

    const issues = vacancyReadinessIssues({
      kind: normalizeVacancyKind(stored.kind),
      description: stored.description ?? "",
      pay: toVacancyPay(stored),
    });

    if (issues.length > 0) {
      return NextResponse.json(
        { error: "The vacancy is not ready to go out", code: issues[0], issues },
        { status: 400 },
      );
    }

    patch = { status: "published" };
  } else if (action === "close") {
    if (status !== "published") {
      return NextResponse.json({ error: "Not open", code: "invalid_status" }, { status: 409 });
    }
    patch = { status: "closed" };
  } else {
    if (state === "draft") {
      return NextResponse.json({ error: "Publish it first", code: "invalid_status" }, { status: 409 });
    }
    // Any new value: the database turns it into 60 days from now.
    patch = { status: "published", expires_at: new Date().toISOString() };
  }

  const { data, error } = await context.supabase
    .from("vacancies")
    .update(patch)
    .eq("id", id)
    .select("id, status, expires_at, moderation_status")
    .maybeSingle();

  if (error) {
    return vacancyWriteErrorResponse(error, "Could not change the vacancy");
  }

  if (!data) {
    return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
  }

  const saved = data as { id: string; status: string; expires_at: string | null; moderation_status: string };

  // Drafts are not screened while they are written; this is the moment.
  const heldForReview =
    action === "publish" &&
    (saved.moderation_status === "approved" || saved.moderation_status === "under_review")
      ? await screenVacancy(id, {
          title: stored.title,
          description: stored.description ?? "",
          city: stored.city,
        })
      : false;

  return NextResponse.json({
    vacancy: {
      id: saved.id,
      status: saved.status,
      expiresAt: saved.expires_at,
      moderationStatus: heldForReview ? "under_review" : saved.moderation_status,
    },
    heldForReview,
  });
}
