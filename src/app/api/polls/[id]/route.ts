import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSanitizedPollTranslations } from "@/lib/poll-translations";
import { ensureUniquePollSlug } from "@/lib/db/polls";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { deleteStorageObject } from "@/lib/storage/provider";
import { createClient } from "@/lib/supabase/server";
import { pollPayloadSchema, routePollIdSchema } from "@/lib/validation/polls";
import { parseJsonRequest } from "@/lib/validation/request";
import { isPublicModerationStatus } from "@/lib/moderation";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import { buildSavePollPayload } from "@/lib/db/save-poll-payload";
import { syncCoAuthors } from "@/lib/db/co-authors";
import {
  CLEAN_MODERATION_RESULT,
  collectPollModerationText,
  describeModerationResult,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { getRequestLocale } from "@/lib/i18n/server";

const pinSchema = z.object({
  pinned_until: z.string().nullable(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routePollIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await context.supabase
    .from("polls")
    .select("id, author_user_id, slug, moderation_status, followers_notified_at")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  if (existing.author_user_id !== context.user.id && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, pollPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const { data: category } = await context.supabase
    .from("poll_categories")
    .select("id, admin_only")
    .eq("slug", payload.category_slug)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (category.admin_only && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Auto-moderation runs only on publish, and only auto-removes a currently
  // approved item — it never touches content an admin already
  // restricted/removed or that is awaiting review.
  const screen =
    payload.status === "published"
      ? screenContentForModeration(collectPollModerationText(payload))
      : CLEAN_MODERATION_RESULT;
  const willRemove = screen.flagged && existing.moderation_status === "approved";

  const slug = await ensureUniquePollSlug(payload.title, id);

  const { data, error } = await context.supabase.rpc("save_poll", {
    p_payload: buildSavePollPayload(payload, {
      id,
      slug,
      categoryId: category.id,
      content: sanitizeRichTextHtml(payload.content),
      translations: buildSanitizedPollTranslations(
        payload.translations,
        payload.content_locale,
      ),
    }),
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not update poll" },
      { status: 400 },
    );
  }

  const result = data as { id: string; slug: string };

  if (willRemove) {
    await autoRemoveContent({ table: "polls", id, note: screen.note });
  }

  // Reconcile co-authors: add newly invited (pending + notify), drop removed.
  await syncCoAuthors({
    supabase: context.supabase,
    contentType: "poll",
    contentId: id,
    contentTitle: payload.title,
    contentSlug: result.slug,
    creatorUserId: existing.author_user_id,
    desiredUserIds: payload.coAuthorUserIds,
  });

  // First publish notifies the author's followers exactly once. A freshly
  // auto-removed edit is not public, so it must not notify.
  if (
    payload.status === "published" &&
    !willRemove &&
    !existing.followers_notified_at &&
    isPublicModerationStatus(existing.moderation_status)
  ) {
    void dispatchPublishSideEffects({
      contentType: "poll",
      contentId: id,
      authorUserId: existing.author_user_id,
      title: payload.title,
      pollSlug: result.slug,
    });
  }

  return NextResponse.json({
    poll: result,
    autoRemoved: willRemove,
    moderationReason: willRemove
      ? describeModerationResult(screen, await getRequestLocale())
      : null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routePollIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid poll id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const context = await getCurrentViewerRole();

  if (!context.user || !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, pinSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error } = await context.supabase
    .from("polls")
    .update({ pinned_until: parsed.data.pinned_until })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routePollIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid poll id" },
      { status: 400 },
    );
  }

  const { id } = routeParams.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("id, author_user_id, cover_image_url, cover_image_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (pollError) {
    return NextResponse.json({ error: pollError.message }, { status: 400 });
  }

  if (!poll || poll.author_user_id !== user.id) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .eq("author_user_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Could not delete poll" },
      { status: 400 },
    );
  }

  if (poll.cover_image_storage_path?.trim() && poll.cover_image_url) {
    const { error: storageError } = await deleteStorageObject({
      supabase,
      bucket: "project-media",
      url: poll.cover_image_url,
      storagePath: poll.cover_image_storage_path.trim(),
    });

    if (storageError) {
      return NextResponse.json({ success: true, cleanupWarning: storageError.message });
    }
  }

  return NextResponse.json({ success: true });
}
