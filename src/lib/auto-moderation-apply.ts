import "server-only";

import type { NotificationMetadata } from "@/lib/constants/notifications";
import { createNotifications } from "@/lib/db/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

type AutoRemoveTable = "articles" | "projects" | "polls";

type AutoRemoveContentArgs = {
  table: AutoRemoveTable;
  id: string;
  note: string | null;
};

const TABLE_TO_KIND: Record<AutoRemoveTable, "article" | "project" | "poll"> = {
  articles: "article",
  projects: "project",
  polls: "poll",
};

const TABLE_TO_TARGET = TABLE_TO_KIND;

/**
 * Auto-remove flagged content: set `moderation_status = 'removed'` and notify
 * the author in-app. The removal is a soft hide (the row stays, hidden by RLS),
 * so a false positive is fully recoverable — an admin can restore it from the
 * moderation tooling, and the `[авто]` note marks it as a system decision.
 *
 * The write goes through the service-role client because the per-table guard
 * triggers (`guard_*_protected_columns`) reset moderation columns for ordinary
 * authenticated callers; the service role (`auth.role() = 'service_role'`) is
 * exempt from those guards and from RLS.
 *
 * Fail-open: if the service-role key is missing or the write fails we log and
 * return false rather than breaking the user's save. The notification is
 * best-effort and never throws (see createNotifications).
 */
export async function autoRemoveContent({
  table,
  id,
  note,
}: AutoRemoveContentArgs): Promise<boolean> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn(
      `[auto-moderation] SUPABASE_SERVICE_ROLE_KEY missing — could not auto-remove ${table}/${id}`,
    );
    return false;
  }

  const { error } = await admin
    .from(table)
    .update({
      moderation_status: "removed",
      moderation_note: note,
      moderated_at: new Date().toISOString(),
      moderated_by: null,
    })
    .eq("id", id);

  if (error) {
    console.error(
      `[auto-moderation] failed to auto-remove ${table}/${id}: ${error.message}`,
    );
    return false;
  }

  // Best-effort in-app notification so the author learns their content was
  // removed (and why). Failures here must never affect the removal above.
  try {
    await notifyAuthorOfRemoval(admin, table, id);
  } catch (notifyError) {
    console.error("[auto-moderation] author notification failed", notifyError);
  }

  return true;
}

async function notifyAuthorOfRemoval(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  table: AutoRemoveTable,
  id: string,
) {
  const metadata: NotificationMetadata = {
    moderationStatus: "removed",
    contentKind: TABLE_TO_KIND[table],
  };

  let ownerId: string | null = null;

  if (table === "articles") {
    const { data } = await admin
      .from("articles")
      .select("author_user_id, title, slug")
      .eq("id", id)
      .maybeSingle();
    ownerId = data?.author_user_id ?? null;
    metadata.contentTitle = data?.title ?? "";
    metadata.articleSlug = data?.slug ?? undefined;
  } else if (table === "polls") {
    const { data } = await admin
      .from("polls")
      .select("author_user_id, title, slug")
      .eq("id", id)
      .maybeSingle();
    ownerId = data?.author_user_id ?? null;
    metadata.contentTitle = data?.title ?? "";
    metadata.pollSlug = data?.slug ?? undefined;
  } else {
    const { data } = await admin
      .from("projects")
      .select("owner_id, title")
      .eq("id", id)
      .maybeSingle();
    ownerId = data?.owner_id ?? null;
    metadata.contentTitle = data?.title ?? "";
    metadata.projectId = id;
  }

  if (!ownerId) {
    return;
  }

  await createNotifications(admin, {
    recipientUserId: ownerId,
    actorUserId: null,
    type: "moderation_decision",
    targetType: TABLE_TO_TARGET[table],
    targetId: id,
    metadata,
  });
}
