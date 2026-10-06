import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describeModerationResult, parseAutoModerationResult } from "@/lib/auto-moderation";
import { sendEmail } from "@/lib/email/resend";
import { buildModerationDecisionEmail } from "@/lib/email/templates";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import {
  normalizeModerationStatus,
  type ModerationStatus,
  type ReportReason,
  type ReportStatus,
  type ReportTargetType,
} from "@/lib/moderation";
import { getSiteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The database does the moderation (database/2026-10-06-moderation-in-db.sql):
 * moderate_content() takes an admin's decision, submit_report() files a
 * report, set_platform_admin() changes an admin role, and triggers log every
 * change and notify the owner. These are their callers, plus the one thing
 * the database cannot do: the e-mail to the owner.
 */

type DbError = { code?: string | null; message?: string | null } | null;

export type DbFailure = { ok: false; status: number; error: string };

function failure(error: DbError, fallback: string): DbFailure {
  const message = error?.message || fallback;
  const status =
    error?.code === "42501" ? 403 : error?.code === "P0002" ? 404 : error?.code === "28000" ? 401 : 400;
  return { ok: false, status, error: message };
}

// --- Decisions -------------------------------------------------------------------------

export type ModerationDecisionItem = {
  id: string;
  previousStatus: ModerationStatus | null;
  status: ModerationStatus;
  changed: boolean;
};

export type ModerateContentInput = {
  targetType: ReportTargetType;
  targetIds: string[];
  status: ModerationStatus;
  note?: string | null;
  reportId?: string | null;
  reportStatus?: ReportStatus | null;
};

function parseDecisionItems(value: unknown): ModerationDecisionItem[] {
  const items = (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item): ModerationDecisionItem[] => {
    const row = item as { id?: unknown; previousStatus?: unknown; status?: unknown; changed?: unknown };
    const status = normalizeModerationStatus(typeof row.status === "string" ? row.status : null);
    if (typeof row.id !== "string" || !status) {
      return [];
    }
    return [
      {
        id: row.id,
        previousStatus: normalizeModerationStatus(
          typeof row.previousStatus === "string" ? row.previousStatus : null,
        ),
        status,
        changed: row.changed === true,
      },
    ];
  });
}

/**
 * One admin decision on one target (or up to 100 for bulk actions), with the
 * report it answers, in one transaction. Runs with the admin's own session.
 */
export async function moderateContent(
  supabase: SupabaseClient,
  input: ModerateContentInput,
): Promise<{ ok: true; items: ModerationDecisionItem[] } | DbFailure> {
  const { data, error } = await supabase.rpc("moderate_content", {
    p_target_type: input.targetType,
    p_target_ids: input.targetIds,
    p_status: input.status,
    p_note: input.note || null,
    p_report_id: input.reportId || null,
    p_report_status: input.reportStatus || null,
  });

  if (error) {
    return failure(error, "Could not update content moderation");
  }

  return { ok: true, items: parseDecisionItems(data) };
}

const EMAIL_TARGETS = {
  profile: { table: "profiles", owner: "user_id", title: "name" },
  project: { table: "projects", owner: "owner_id", title: "title" },
  article: { table: "articles", owner: "author_user_id", title: "title" },
  poll: { table: "polls", owner: "author_user_id", title: "title" },
} as const;

type EmailTarget = keyof typeof EMAIL_TARGETS;

function isEmailTarget(type: ReportTargetType): type is EmailTarget {
  return type in EMAIL_TARGETS;
}

/**
 * The owner of a profile, project, article or poll an admin just removed or
 * restricted gets an e-mail (the in-app notification is the database's). A
 * company page or a vacancy is told in the app only, as before. Best-effort:
 * a failure is logged, never thrown — the decision already stands.
 */
export async function emailModerationDecisions({
  targetType,
  items,
  note,
}: {
  targetType: ReportTargetType;
  items: ModerationDecisionItem[];
  note: string | null;
}): Promise<void> {
  if (!isEmailTarget(targetType)) {
    return;
  }

  const hidden = items.filter(
    (item) => item.changed && (item.status === "removed" || item.status === "restricted"),
  );

  if (hidden.length === 0) {
    return;
  }

  const admin = createAdminClient();
  if (!admin) {
    return;
  }

  for (const item of hidden) {
    try {
      await emailOne(admin, targetType, item.id, item.status as "removed" | "restricted", note);
    } catch (error) {
      console.error("[moderation] owner email failed", { targetType, id: item.id, error });
    }
  }
}

async function emailOne(
  admin: SupabaseClient,
  targetType: EmailTarget,
  id: string,
  status: "removed" | "restricted",
  note: string | null,
) {
  const target = EMAIL_TARGETS[targetType];
  const { data } = await admin
    .from(target.table)
    .select(targetType === "profile" ? "user_id, name, username" : `${target.owner}, title, slug`)
    .eq("id", id)
    .maybeSingle();

  const row = data as Record<string, string | null> | null;
  const ownerId = row?.[target.owner] ?? null;

  if (!row || !ownerId) {
    return;
  }

  const { data: ownerAuth } = await admin.auth.admin.getUserById(ownerId);
  const recipientEmail = ownerAuth?.user?.email;

  if (!recipientEmail) {
    return;
  }

  const rawLocale = (ownerAuth?.user?.user_metadata?.locale as string | undefined) || defaultLocale;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("name, username")
    .eq("user_id", ownerId)
    .maybeSingle();
  const recipientName = ownerProfile?.name?.trim() || ownerProfile?.username || "";

  const contentTitle =
    targetType === "profile" ? row.name?.trim() || row.username || "" : row.title || "";
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const path =
    targetType === "article"
      ? row.slug ? `/${locale}/articles/${row.slug}` : `/${locale}/articles`
      : targetType === "poll"
        ? row.slug ? `/${locale}/polls/${row.slug}` : `/${locale}/polls`
        : targetType === "project"
          ? `/${locale}/projects/${id}`
          : row.username ? `/${locale}/u/${row.username}` : `/${locale}/talents`;

  const { subject, html, text } = buildModerationDecisionEmail({
    recipientName,
    contentKind: targetType,
    contentTitle,
    status,
    note,
    url: `${siteUrl}${path}`,
    locale,
  });

  await sendEmail({ to: recipientEmail, subject, html, text });
}

// --- Auto-moderation -------------------------------------------------------------------

/**
 * Why auto-moderation just took the caller's own project, article or poll
 * down, as one sentence for the form. The generic sentence when the database
 * has no details.
 */
export async function readAutoModerationReason(
  supabase: SupabaseClient,
  targetType: "project" | "article" | "poll",
  targetId: string,
  locale: Locale,
): Promise<string> {
  const { data } = await supabase.rpc("content_auto_moderation", {
    p_target_type: targetType,
    p_target_id: targetId,
  });

  return describeModerationResult(parseAutoModerationResult(data), locale);
}

/**
 * Public projects among `ids` whose title or description the blocklist
 * catches today — content can predate a new term in moderation_terms. The
 * leaderboards and the home page leave them out. On an error nothing is left
 * out (and it is logged): a hiccup must not empty the boards.
 */
export async function loadBlocklistedProjectIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase.rpc("blocklisted_project_ids", { p_ids: ids });

  if (error) {
    console.error("[moderation] blocklist check failed:", error.message);
    return new Set();
  }

  return new Set(
    ((data ?? []) as unknown[]).map((row) =>
      typeof row === "string" ? row : String((row as Record<string, unknown>).blocklisted_project_ids ?? ""),
    ),
  );
}

// --- Reports ---------------------------------------------------------------------------

export type SubmitReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
};

/**
 * Files a report with the reporter's session. The database sets the owner and
 * the priority, refuses one's own content, a hidden target, a duplicate and
 * more than 5 a minute, and an urgent report holds the target at once.
 */
export async function submitReport(
  supabase: SupabaseClient,
  input: SubmitReportInput,
): Promise<{ ok: true; id: string } | DbFailure> {
  const { data, error } = await supabase.rpc("submit_report", {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_details: input.details || null,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("report_target_not_found")) {
      return { ok: false, status: 404, error: "Content not found" };
    }
    if (message.includes("cannot_report_own_content")) {
      return { ok: false, status: 400, error: "You cannot report your own content" };
    }
    if (message.includes("duplicate_report") || error.code === "23505") {
      return { ok: false, status: 409, error: "A similar active report already exists" };
    }
    if (message.includes("report_rate_limited")) {
      return { ok: false, status: 429, error: "Too many reports. Try again in a minute." };
    }
    return failure(error, "Could not create report");
  }

  return { ok: true, id: String((data as { id?: unknown } | null)?.id ?? "") };
}

// --- Admin roles -----------------------------------------------------------------------

/** Grants or takes back an admin role with the admin's own session. */
export async function setPlatformAdmin(
  supabase: SupabaseClient,
  userId: string,
  admin: boolean,
): Promise<{ ok: true; changed: boolean } | DbFailure> {
  const { data, error } = await supabase.rpc("set_platform_admin", {
    p_user_id: userId,
    p_admin: admin,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("cannot_change_own_admin_role")) {
      return { ok: false, status: 400, error: "Cannot modify your own admin role" };
    }
    if (message.includes("user_not_found")) {
      return { ok: false, status: 404, error: "User not found" };
    }
    if (message.includes("last_admin")) {
      return { ok: false, status: 409, error: "The last admin cannot be removed" };
    }
    return failure(error, admin ? "Could not grant admin role" : "Could not revoke admin role");
  }

  return { ok: true, changed: (data as { changed?: unknown } | null)?.changed === true };
}
