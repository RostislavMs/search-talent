import { NextResponse } from "next/server";
import { buildSanitizedTranslations } from "@/lib/article-translations";
import { ensureUniqueArticleSlug, getArticleFeed } from "@/lib/db/articles";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { articlePayloadSchema } from "@/lib/validation/articles";
import { parseJsonRequest } from "@/lib/validation/request";
import { dbRateLimit } from "@/lib/rate-limit";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  CLEAN_MODERATION_RESULT,
  collectArticleModerationText,
  describeModerationResult,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { getRequestLocale } from "@/lib/i18n/server";
import { inviteCoAuthors } from "@/lib/db/co-authors";
import { sanitizeCoAuthorIds } from "@/lib/co-authors";

// Community feed for the `/articles` page. The listing filters (category,
// author, sort) live in client state rather than the URL — mirroring the
// /talents & /projects discovery pages — so filter changes fetch here instead
// of navigating. The page still SSRs the default (unfiltered) feed, so this
// endpoint is only ever hit by user-driven filtering; crawlers see the seeded
// cards and never depend on this route (which robots.txt blocks anyway).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feed = await getArticleFeed({
    categorySlug: searchParams.get("category") || null,
    authorQuery: searchParams.get("author") || null,
    search: searchParams.get("search") || null,
    sort: searchParams.get("sort") || null,
    locale: searchParams.get("locale") || null,
  });

  return NextResponse.json({ items: feed.items });
}

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Throttle content creation (shared across projects/articles/polls) to stop a
  // single account from flooding the public feeds and follower notifications.
  const limited = await dbRateLimit(
    context.supabase,
    `create-content:${context.user.id}`,
    5,
    60_000,
  );
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, articlePayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const coAuthorIds = sanitizeCoAuthorIds(payload.coAuthorUserIds, context.user.id);
  const holdForCoAuthors = payload.status === "published" && coAuthorIds.length > 0;

  const { data: category } = await context.supabase
    .from("article_categories")
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

  // Auto-moderation runs only on publish. A flagged article is auto-removed
  // (hidden by RLS) right after insert and the author is notified; clean
  // content keeps the previous auto-approve behaviour.
  const screen =
    payload.status === "published"
      ? screenContentForModeration(collectArticleModerationText(payload))
      : CLEAN_MODERATION_RESULT;

  const slug = await ensureUniqueArticleSlug(
    payload.title,
    undefined,
    payload.slug,
  );
  const now = new Date().toISOString();
  const { data, error } = await context.supabase
    .from("articles")
    .insert({
      author_user_id: context.user.id,
      category_id: category.id,
      title: payload.title,
      slug,
      excerpt: payload.excerpt,
      content: sanitizeRichTextHtml(payload.content),
      cover_image_url: payload.cover_image_url,
      cover_image_storage_path: payload.cover_image_storage_path,
      hero_video_url: payload.hero_video_url,
      hero_video_storage_path: payload.hero_video_storage_path,
      content_locale: payload.content_locale,
      translations: buildSanitizedTranslations(
        payload.translations,
        payload.content_locale,
      ),
      status: holdForCoAuthors ? "draft" : payload.status,
      publish_on_confirm: holdForCoAuthors,
      moderation_status: "approved",
      published_at:
        payload.status === "published" && !holdForCoAuthors ? now : null,
    })
    .select("id, slug")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not create article" },
      { status: 400 },
    );
  }

  if (screen.flagged) {
    await autoRemoveContent({ table: "articles", id: data.id, note: screen.note });
  }

  if (coAuthorIds.length > 0 && !screen.flagged) {
    await inviteCoAuthors({
      supabase: context.supabase,
      contentType: "article",
      contentId: data.id,
      contentTitle: payload.title,
      contentSlug: data.slug,
      creatorUserId: context.user.id,
      coAuthorUserIds: coAuthorIds,
    });
  }

  // Notify followers only when the article is actually public (published AND
  // not auto-removed). A draft held for co-authors notifies on auto-publish.
  if (payload.status === "published" && !screen.flagged && !holdForCoAuthors) {
    void dispatchPublishSideEffects({
      contentType: "article",
      contentId: data.id,
      authorUserId: context.user.id,
      title: payload.title,
      articleSlug: data.slug,
    });
  }

  return NextResponse.json({
    article: data,
    autoRemoved: screen.flagged,
    moderationReason: screen.flagged
      ? describeModerationResult(screen, await getRequestLocale())
      : null,
    awaitingCoAuthors: holdForCoAuthors,
  });
}
