import "server-only";

import { REPORT_TARGETS } from "@/lib/moderation";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * An urgent report takes a profile, project or article off public view until
 * a moderator looks. Written with the service key: the reporter's own session
 * cannot touch another person's moderation (RLS and the guard triggers stop
 * it), which is why this used to do nothing. Only approved content is held —
 * a decision an admin already made stays. True when something was held.
 *
 * Company pages and vacancies have their own holds (holdCompanyForReview,
 * holdVacancyForReview).
 */
export async function holdReportedContent(
  type: "profile" | "project" | "article",
  id: string,
  note: string,
): Promise<boolean> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn(`[moderation] SUPABASE_SERVICE_ROLE_KEY missing — could not hold ${type} ${id}`);
    return false;
  }

  const { data, error } = await admin
    .from(REPORT_TARGETS[type].table)
    .update({
      moderation_status: "under_review",
      moderation_note: note,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .or("moderation_status.is.null,moderation_status.eq.approved")
    .select("id");

  if (error) {
    console.error(`[moderation] could not hold ${type} ${id}: ${error.message}`);
    return false;
  }

  return Boolean(data && data.length > 0);
}
