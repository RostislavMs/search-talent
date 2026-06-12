import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type FlagContentForReviewArgs = {
  table: "articles" | "projects" | "polls";
  id: string;
  note: string | null;
};

/**
 * Move auto-flagged content to `under_review` using the service-role client.
 *
 * The per-table guard triggers (`guard_*_protected_columns`) reset
 * moderation columns to their previous value for ordinary authenticated
 * callers on UPDATE, so an author's own edit can never change the status.
 * The service role (`auth.role() = 'service_role'`) is exempt from those
 * guards and from RLS, which is exactly why we route the write through it.
 *
 * Fail-open: if the service-role key is not configured (or the write fails)
 * we log and return false rather than breaking the user's save. The content
 * stays publicly approved — community reports / manual review remain the
 * backstop — and the issue surfaces in the logs.
 */
export async function flagContentForReview({
  table,
  id,
  note,
}: FlagContentForReviewArgs): Promise<boolean> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn(
      `[auto-moderation] SUPABASE_SERVICE_ROLE_KEY missing — could not flag ${table}/${id} for review`,
    );
    return false;
  }

  const { error } = await admin
    .from(table)
    .update({
      moderation_status: "under_review",
      moderation_note: note,
      moderated_at: new Date().toISOString(),
      moderated_by: null,
    })
    .eq("id", id);

  if (error) {
    console.error(
      `[auto-moderation] failed to flag ${table}/${id} for review: ${error.message}`,
    );
    return false;
  }

  return true;
}
