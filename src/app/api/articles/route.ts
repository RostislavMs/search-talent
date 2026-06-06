import { NextResponse } from "next/server";
import {
  buildSanitizedTranslations,
  ensureUniqueArticleSlug,
} from "@/lib/db/articles";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { sanitizeRichTextHtml } from "@/lib/rich-text";
import { articlePayloadSchema } from "@/lib/validation/articles";
import { parseJsonRequest } from "@/lib/validation/request";

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
      status: payload.status,
      moderation_status: "approved",
      published_at: payload.status === "published" ? now : null,
    })
    .select("id, slug")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Could not create article" },
      { status: 400 },
    );
  }

  return NextResponse.json({ article: data });
}
