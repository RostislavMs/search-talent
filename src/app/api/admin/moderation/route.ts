import { NextResponse } from "next/server";
import type { NotificationMetadata } from "@/lib/constants/notifications";
import { createNotifications } from "@/lib/db/notifications";
import { sendEmail } from "@/lib/email/resend";
import { buildModerationDecisionEmail } from "@/lib/email/templates";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import {
  getModerationActionType,
  normalizeModerationStatus,
} from "@/lib/moderation";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { getSiteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderationUpdateSchema } from "@/lib/validation/report";
import { parseJsonRequest } from "@/lib/validation/request";

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, moderationUpdateSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const { supabase, user } = context;

  const targetResponse =
    payload.targetType === "profile"
      ? await supabase
          .from("profiles")
          .select("id, moderation_status")
          .eq("id", payload.targetId)
          .maybeSingle()
      : payload.targetType === "article"
        ? await supabase
            .from("articles")
            .select("id, moderation_status")
            .eq("id", payload.targetId)
            .maybeSingle()
        : await supabase
            .from("projects")
            .select("id, moderation_status")
            .eq("id", payload.targetId)
            .maybeSingle();

  const target = targetResponse.data as
    | { id: string; moderation_status: string | null }
    | null;

  if (!target) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const previousStatus = normalizeModerationStatus(target.moderation_status);
  const targetUpdate = {
    moderation_status: payload.moderationStatus,
    moderation_note: payload.resolutionNote || null,
    moderated_at: new Date().toISOString(),
    moderated_by: user.id,
  };

  const targetUpdateResponse =
    payload.targetType === "profile"
      ? await supabase.from("profiles").update(targetUpdate).eq("id", payload.targetId)
      : payload.targetType === "article"
        ? await supabase.from("articles").update(targetUpdate).eq("id", payload.targetId)
        : await supabase.from("projects").update(targetUpdate).eq("id", payload.targetId);

  if (targetUpdateResponse.error) {
    return NextResponse.json(
      { error: targetUpdateResponse.error.message || "Could not update content moderation" },
      { status: 400 },
    );
  }

  if (payload.reportId) {
    const { error: reportError } = await supabase
      .from("content_reports")
      .update({
        status: payload.reportStatus || "resolved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        resolution_note: payload.resolutionNote || null,
      })
      .eq("id", payload.reportId);

    if (reportError) {
      return NextResponse.json(
        { error: reportError.message || "Could not update report status" },
        { status: 400 },
      );
    }
  }

  const { error: actionError } = await supabase.from("moderation_actions").insert({
    actor_user_id: user.id,
    report_id: payload.reportId || null,
    target_type: payload.targetType,
    target_profile_id: payload.targetType === "profile" ? payload.targetId : null,
    target_project_id: payload.targetType === "project" ? payload.targetId : null,
    target_article_id: payload.targetType === "article" ? payload.targetId : null,
    previous_status: previousStatus,
    next_status: payload.moderationStatus,
    report_status: payload.reportStatus || null,
    action_type: getModerationActionType(previousStatus, payload.moderationStatus),
    note: payload.resolutionNote || null,
  });

  if (actionError) {
    return NextResponse.json(
      { error: actionError.message || "Could not store moderation action" },
      { status: 400 },
    );
  }

  // Notify the content owner when their content is removed or restricted.
  // Best-effort: a failure here must never fail the moderation action.
  if (
    payload.moderationStatus === "removed" ||
    payload.moderationStatus === "restricted"
  ) {
    try {
      await notifyContentOwner({
        targetType: payload.targetType,
        targetId: payload.targetId,
        status: payload.moderationStatus,
        note: payload.resolutionNote || null,
      });
    } catch (error) {
      console.error("[moderation] owner notification failed", error);
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * Sends the content owner an in-app notification and a best-effort email when
 * their content is removed or restricted. Uses the service-role client so it
 * can write notifications for another user and read their auth email.
 */
async function notifyContentOwner({
  targetType,
  targetId,
  status,
  note,
}: {
  targetType: "profile" | "project" | "article";
  targetId: string;
  status: "removed" | "restricted";
  note: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const metadata: NotificationMetadata = {
    moderationStatus: status,
    contentKind: targetType,
  };
  let ownerId: string | null = null;
  let contentTitle = "";

  if (targetType === "article") {
    const { data } = await admin
      .from("articles")
      .select("author_user_id, title, slug")
      .eq("id", targetId)
      .maybeSingle();
    ownerId = data?.author_user_id ?? null;
    contentTitle = data?.title ?? "";
    metadata.articleSlug = data?.slug ?? undefined;
  } else if (targetType === "project") {
    const { data } = await admin
      .from("projects")
      .select("owner_id, title")
      .eq("id", targetId)
      .maybeSingle();
    ownerId = data?.owner_id ?? null;
    contentTitle = data?.title ?? "";
    metadata.projectId = targetId;
  } else {
    const { data } = await admin
      .from("profiles")
      .select("user_id, name, username")
      .eq("id", targetId)
      .maybeSingle();
    ownerId = data?.user_id ?? null;
    contentTitle = data?.name?.trim() || data?.username || "";
    metadata.profileUsername = data?.username ?? undefined;
  }

  if (!ownerId) {
    return;
  }

  metadata.contentTitle = contentTitle;

  await createNotifications(admin, {
    recipientUserId: ownerId,
    actorUserId: null,
    type: "moderation_decision",
    targetType,
    targetId,
    metadata,
  });

  const { data: ownerAuth } = await admin.auth.admin.getUserById(ownerId);
  const recipientEmail = ownerAuth?.user?.email;

  if (!recipientEmail) {
    return;
  }

  const rawLocale =
    (ownerAuth?.user?.user_metadata?.locale as string | undefined) ||
    defaultLocale;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("name, username")
    .eq("user_id", ownerId)
    .maybeSingle();
  const recipientName =
    ownerProfile?.name?.trim() || ownerProfile?.username || "";

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const path =
    targetType === "article"
      ? metadata.articleSlug
        ? `/${locale}/articles/${metadata.articleSlug}`
        : `/${locale}/articles`
      : targetType === "project"
        ? `/${locale}/projects/${targetId}`
        : metadata.profileUsername
          ? `/${locale}/u/${metadata.profileUsername}`
          : `/${locale}/talents`;

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
