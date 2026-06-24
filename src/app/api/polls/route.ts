import { NextResponse } from "next/server";
import { buildSanitizedPollTranslations } from "@/lib/poll-translations";
import { ensureUniquePollSlug } from "@/lib/db/polls";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { pollPayloadSchema } from "@/lib/validation/polls";
import { parseJsonRequest } from "@/lib/validation/request";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import { buildSavePollPayload } from "@/lib/db/save-poll-payload";
import {
  CLEAN_MODERATION_RESULT,
  collectPollModerationText,
  describeModerationResult,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { getRequestLocale } from "@/lib/i18n/server";
import { inviteCoAuthors } from "@/lib/db/co-authors";
import { sanitizeCoAuthorIds } from "@/lib/co-authors";

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonRequest(request, pollPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const coAuthorIds = sanitizeCoAuthorIds(payload.coAuthorUserIds, context.user.id);
  const holdForCoAuthors = payload.status === "published" && coAuthorIds.length > 0;

  const { data: category } = await context.supabase
    .from("poll_categories")
    .select("id, admin_only")
    .eq("slug", payload.category_slug)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (category.admin_only && !context.isAdmin) {
    return NextResponse.json(
      { error: "Only admins can publish in this category" },
      { status: 403 },
    );
  }

  // Auto-moderation runs only on publish. `save_poll` always inserts as
  // 'approved'; a flagged poll is auto-removed right after via the service-role
  // client (the guard trigger blocks the author from changing moderation cols).
  const screen =
    payload.status === "published"
      ? screenContentForModeration(collectPollModerationText(payload))
      : CLEAN_MODERATION_RESULT;

  const slug = await ensureUniquePollSlug(payload.title);

  const { data, error } = await context.supabase.rpc("save_poll", {
    p_payload: buildSavePollPayload(
      // Held for co-authors: insert as a draft so it stays private until every
      // invitee accepts, then auto-publishes.
      holdForCoAuthors ? { ...payload, status: "draft" } : payload,
      {
        id: null,
        slug,
        categoryId: category.id,
        content: sanitizeRichTextHtml(payload.content),
        translations: buildSanitizedPollTranslations(
          payload.translations,
          payload.content_locale,
        ),
      },
    ),
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not create poll" },
      { status: 400 },
    );
  }

  const result = data as { id: string; slug: string };

  if (screen.flagged) {
    await autoRemoveContent({ table: "polls", id: result.id, note: screen.note });
  }

  if (holdForCoAuthors) {
    // `save_poll` doesn't know about the publish-on-confirm guard column.
    await context.supabase
      .from("polls")
      .update({ publish_on_confirm: true })
      .eq("id", result.id);
  }

  if (coAuthorIds.length > 0 && !screen.flagged) {
    await inviteCoAuthors({
      supabase: context.supabase,
      contentType: "poll",
      contentId: result.id,
      contentTitle: payload.title,
      contentSlug: result.slug,
      creatorUserId: context.user.id,
      coAuthorUserIds: coAuthorIds,
    });
  }

  // Notify followers only when the poll is actually public (published AND not
  // auto-removed). A draft held for co-authors notifies on auto-publish.
  if (payload.status === "published" && !screen.flagged && !holdForCoAuthors) {
    void dispatchPublishSideEffects({
      contentType: "poll",
      contentId: result.id,
      authorUserId: context.user.id,
      title: payload.title,
      pollSlug: result.slug,
    });
  }

  return NextResponse.json({
    poll: result,
    autoRemoved: screen.flagged,
    moderationReason: screen.flagged
      ? describeModerationResult(screen, await getRequestLocale())
      : null,
    awaitingCoAuthors: holdForCoAuthors,
  });
}
