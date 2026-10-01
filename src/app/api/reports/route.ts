import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyRole, holdCompanyForReview } from "@/lib/db/companies";
import { holdReportedContent } from "@/lib/db/moderation-holds";
import { holdVacancyForReview } from "@/lib/db/vacancies";
import {
  REPORT_TARGETS,
  getReportPriority,
  normalizeModerationStatus,
  reportHoldsTarget,
  reportTargetColumns,
  type ReportTargetType,
} from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { reportPayloadSchema } from "@/lib/validation/report";
import { parseJsonRequest } from "@/lib/validation/request";

const AUTO_REVIEW_NOTE = "Moved to review automatically after an urgent community report.";

type ReportTarget = {
  ownerUserId: string | null;
  moderationStatus: string | null;
  /** For a company page or a vacancy: the company whose team owns it. */
  companyId: string | null;
};

/** The target as the reporter can see it, or null when there is none. */
async function loadReportTarget(
  supabase: SupabaseClient,
  type: ReportTargetType,
  id: string,
): Promise<ReportTarget | null> {
  switch (type) {
    case "profile": {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, moderation_status")
        .eq("id", id)
        .maybeSingle();
      const row = data as { user_id: string; moderation_status: string | null } | null;
      return row ? { ownerUserId: row.user_id, moderationStatus: row.moderation_status, companyId: null } : null;
    }
    case "article": {
      const { data } = await supabase
        .from("articles")
        .select("id, author_user_id, moderation_status")
        .eq("id", id)
        .maybeSingle();
      const row = data as { author_user_id: string; moderation_status: string | null } | null;
      return row
        ? { ownerUserId: row.author_user_id, moderationStatus: row.moderation_status, companyId: null }
        : null;
    }
    case "project": {
      const { data } = await supabase
        .from("projects")
        .select("id, owner_id, moderation_status")
        .eq("id", id)
        .maybeSingle();
      const row = data as { owner_id: string; moderation_status: string | null } | null;
      return row ? { ownerUserId: row.owner_id, moderationStatus: row.moderation_status, companyId: null } : null;
    }
    case "company": {
      const { data } = await supabase
        .from("companies")
        .select("id, created_by, moderation_status")
        .eq("id", id)
        .maybeSingle();
      const row = data as { id: string; created_by: string | null; moderation_status: string } | null;
      return row ? { ownerUserId: row.created_by, moderationStatus: row.moderation_status, companyId: row.id } : null;
    }
    case "vacancy": {
      const { data } = await supabase
        .from("vacancies")
        .select("id, author_user_id, company_id, moderation_status")
        .eq("id", id)
        .maybeSingle();
      const row = data as {
        author_user_id: string | null;
        company_id: string;
        moderation_status: string;
      } | null;
      return row
        ? { ownerUserId: row.author_user_id, moderationStatus: row.moderation_status, companyId: row.company_id }
        : null;
    }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`report:${user.id}`, 5, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, reportPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const target = await loadReportTarget(supabase, payload.targetType, payload.targetId);

  if (!target) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  // A company's page and vacancies are the whole team's own.
  const isOwn =
    target.ownerUserId === user.id ||
    (target.companyId !== null &&
      (await getCompanyRole(supabase, target.companyId, user.id)) !== null);

  if (isOwn) {
    return NextResponse.json(
      { error: "You cannot report your own content" },
      { status: 400 },
    );
  }

  const targetColumn = REPORT_TARGETS[payload.targetType].column;

  const duplicateQuery = supabase
    .from("content_reports")
    .select("id")
    .eq("reporter_user_id", user.id)
    .eq(targetColumn, payload.targetId)
    .eq("reason", payload.reason)
    .in("status", ["open", "triaged"])
    .maybeSingle();

  const { data: duplicateReport } = await duplicateQuery;

  if (duplicateReport) {
    return NextResponse.json(
      { error: "A similar active report already exists" },
      { status: 409 },
    );
  }

  const priority = getReportPriority(payload.reason);
  const { error: insertError } = await supabase.from("content_reports").insert({
    target_type: payload.targetType,
    ...reportTargetColumns(payload.targetType, payload.targetId),
    target_owner_user_id: target.ownerUserId,
    reporter_user_id: user.id,
    reason: payload.reason,
    details: payload.details || null,
    priority,
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message || "Could not create report" },
      { status: 400 },
    );
  }

  const currentStatus = normalizeModerationStatus(target.moderationStatus);

  if (reportHoldsTarget(payload.targetType, payload.reason) && currentStatus !== "under_review") {
    // The reporter cannot touch someone else's moderation, so the hold is
    // written with the service key.
    if (payload.targetType === "company") {
      await holdCompanyForReview(payload.targetId, AUTO_REVIEW_NOTE);
    } else if (payload.targetType === "vacancy") {
      await holdVacancyForReview(payload.targetId, AUTO_REVIEW_NOTE);
    } else {
      await holdReportedContent(payload.targetType, payload.targetId, AUTO_REVIEW_NOTE);
    }
  }

  return NextResponse.json({ success: true });
}
