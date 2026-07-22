import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/db/notifications";
import { pollCommentPayloadSchema, routePollIdSchema } from "@/lib/validation/polls";
import { parseJsonRequest } from "@/lib/validation/request";
import { dbRateLimit } from "@/lib/rate-limit";
import type { CreateNotificationInput } from "@/lib/db/notifications";
import { isAllowedGifUrl } from "@/lib/gif/provider";
import {
  describeModerationResult,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { getRequestLocale } from "@/lib/i18n/server";

export async function POST(
  request: Request,
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

  // Throttle comment creation: without this, one account can loop-post
  // comments to flood the DB and spam notifications at a targeted user.
  const limited = await dbRateLimit(supabase, `comment:${user.id}`, 10, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, pollCommentPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Never trust a client-supplied GIF URL: it must be an https provider-CDN URL.
  if (parsed.data.media_url && !isAllowedGifUrl(parsed.data.media_url)) {
    return NextResponse.json({ error: "Invalid GIF URL" }, { status: 400 });
  }

  // Comments have no review pipeline, so a flagged comment is rejected outright
  // with a precise, localized explanation the author can act on. A GIF-only
  // comment has no text to screen.
  if (parsed.data.body.trim()) {
    const screen = screenContentForModeration([parsed.data.body]);
    if (screen.flagged) {
      return NextResponse.json(
        {
          error: describeModerationResult(screen, await getRequestLocale()),
          code: "moderation_blocked",
        },
        { status: 400 },
      );
    }
  }

  const { data: poll } = await supabase
    .from("polls")
    .select("id, slug, author_user_id, status, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!poll || poll.status !== "published" || !isPublicModerationStatus(poll.moderation_status)) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  let parentAuthorUserId: string | null = null;
  if (parsed.data.parent_id) {
    const { data: parent } = await supabase
      .from("poll_comments")
      .select("author_user_id")
      .eq("id", parsed.data.parent_id)
      .maybeSingle();
    parentAuthorUserId = parent?.author_user_id ?? null;
  }

  const { data: inserted, error } = await supabase
    .from("poll_comments")
    .insert({
      poll_id: id,
      author_user_id: user.id,
      parent_id: parsed.data.parent_id,
      body: parsed.data.body,
      media_url: parsed.data.media_url,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message || "Failed to create comment" },
      { status: 400 },
    );
  }

  // Lightweight notifications: ping the poll author on top-level comments and
  // the parent author on replies. Fire-and-forget; never block the insert.
  const admin = createAdminClient();
  if (admin) {
    const metadata = {
      pollSlug: poll.slug ?? undefined,
      excerpt: parsed.data.body.trim() ? parsed.data.body.slice(0, 160) : "GIF",
    };
    const inserts: CreateNotificationInput[] = [];

    if (parentAuthorUserId && parentAuthorUserId !== user.id) {
      inserts.push({
        recipientUserId: parentAuthorUserId,
        actorUserId: user.id,
        type: "comment_reply",
        targetType: "poll_comment",
        targetId: inserted.id,
        metadata,
      });
    }

    if (
      poll.author_user_id &&
      poll.author_user_id !== user.id &&
      poll.author_user_id !== parentAuthorUserId &&
      !parsed.data.parent_id
    ) {
      inserts.push({
        recipientUserId: poll.author_user_id,
        actorUserId: user.id,
        type: "new_comment",
        targetType: "poll_comment",
        targetId: inserted.id,
        metadata,
      });
    }

    if (inserts.length > 0) {
      void createNotifications(admin, inserts);
    }
  }

  return NextResponse.json({ success: true, id: inserted.id });
}
