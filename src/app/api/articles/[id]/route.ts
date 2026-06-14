import { NextResponse } from "next/server";
import { buildSanitizedTranslations } from "@/lib/article-translations";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { deleteStorageObject } from "@/lib/storage/provider";
import { createClient } from "@/lib/supabase/server";
import { articlePayloadSchema, routeArticleIdSchema } from "@/lib/validation/articles";
import { ensureUniqueArticleSlug } from "@/lib/db/articles";
import { parseJsonRequest } from "@/lib/validation/request";
import { isPublicModerationStatus } from "@/lib/moderation";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import {
  collectArticleModerationText,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { syncCoAuthors } from "@/lib/db/co-authors";
import { z } from "zod";

const pinSchema = z.object({
  pinned_until: z.string().nullable(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeArticleIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: existing } = await context.supabase
    .from("articles")
    .select("id, author_user_id, slug, moderation_status, followers_notified_at")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  if (existing.author_user_id !== context.user.id && !context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, articlePayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.data;
  const { data: category } = await context.supabase
    .from("article_categories")
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
      ? screenContentForModeration(collectArticleModerationText(payload))
      : { flagged: false as const, categories: [], note: null };
  const willRemove = screen.flagged && existing.moderation_status === "approved";

  const slug = await ensureUniqueArticleSlug(payload.title, id);
  const now = new Date().toISOString();

  const { data, error } = await context.supabase
    .from("articles")
    .update({
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
      status: payload.status,
      published_at: payload.status === "published" ? now : null,
    })
    .eq("id", id)
    .select("id, slug")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Could not update article" }, { status: 400 });
  }

  if (willRemove) {
    await autoRemoveContent({ table: "articles", id, note: screen.note });
  }

  // Reconcile co-authors: add newly invited (pending + notify), drop removed.
  await syncCoAuthors({
    supabase: context.supabase,
    contentType: "article",
    contentId: id,
    contentTitle: payload.title,
    contentSlug: data.slug,
    creatorUserId: existing.author_user_id,
    desiredUserIds: payload.coAuthorUserIds,
  });

  // First publish (draft -> published) notifies the author's followers. The
  // actor is the author, not the (possibly admin) editor. The
  // followers_notified_at guard keeps re-publishes and later edits silent.
  // A freshly auto-removed edit is not public, so it must not notify.
  if (
    payload.status === "published" &&
    !willRemove &&
    !existing.followers_notified_at &&
    isPublicModerationStatus(existing.moderation_status)
  ) {
    void dispatchPublishSideEffects({
      contentType: "article",
      contentId: id,
      authorUserId: existing.author_user_id,
      title: payload.title,
      articleSlug: data.slug,
    });
  }

  return NextResponse.json({ article: data, autoRemoved: willRemove });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeArticleIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
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
    .from("articles")
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
  const routeParams = routeArticleIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.issues[0]?.message || "Invalid article id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("id, author_user_id, cover_image_url, cover_image_storage_path, hero_video_url, hero_video_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (articleError) {
    return NextResponse.json({ error: articleError.message }, { status: 400 });
  }

  if (!article || article.author_user_id !== user.id) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("articles")
    .delete()
    .eq("id", id)
    .eq("author_user_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || "Could not delete article" },
      { status: 400 },
    );
  }

  const assets: Array<{ url: string; storagePath: string }> = [];
  if (article.cover_image_storage_path?.trim() && article.cover_image_url) {
    assets.push({
      url: article.cover_image_url,
      storagePath: article.cover_image_storage_path.trim(),
    });
  }
  if (article.hero_video_storage_path?.trim() && article.hero_video_url) {
    assets.push({
      url: article.hero_video_url,
      storagePath: article.hero_video_storage_path.trim(),
    });
  }

  const cleanupWarnings: string[] = [];
  for (const asset of assets) {
    const { error: storageError } = await deleteStorageObject({
      supabase,
      bucket: "project-media",
      url: asset.url,
      storagePath: asset.storagePath,
    });

    if (storageError) {
      cleanupWarnings.push(storageError.message);
    }
  }

  if (cleanupWarnings.length > 0) {
    return NextResponse.json({
      success: true,
      cleanupWarning: cleanupWarnings[0],
    });
  }

  return NextResponse.json({ success: true });
}
