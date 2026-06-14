import { NextResponse } from "next/server";
import { buildSanitizedTranslations } from "@/lib/article-translations";
import { ensureUniqueArticleSlug } from "@/lib/db/articles";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { articlePayloadSchema } from "@/lib/validation/articles";
import { parseJsonRequest } from "@/lib/validation/request";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  collectArticleModerationText,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { inviteCoAuthors } from "@/lib/db/co-authors";
import { sanitizeCoAuthorIds } from "@/lib/co-authors";

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      : { flagged: false as const, categories: [], note: null };

  const slug = await ensureUniqueArticleSlug(payload.title);
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
    awaitingCoAuthors: holdForCoAuthors,
  });
}
