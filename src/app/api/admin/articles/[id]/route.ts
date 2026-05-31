import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { deleteStorageObject } from "@/lib/storage/provider";
import {
  articleModerationPayloadSchema,
  routeArticleIdSchema,
} from "@/lib/validation/articles";
import { parseJsonRequest } from "@/lib/validation/request";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeArticleIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.issues[0]?.message || "Invalid article id" }, { status: 400 });
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonRequest(request, articleModerationPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { id } = routeParams.data;
  const { data: article } = await context.supabase
    .from("articles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const { error } = await context.supabase
    .from("articles")
    .update({
      moderation_status: parsed.data.moderation_status,
      moderation_note: parsed.data.moderation_note,
      moderated_at: new Date().toISOString(),
      moderated_by: context.user.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not update article moderation" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeArticleIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid article id" },
      { status: 400 },
    );
  }

  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = routeParams.data;
  const { data: article, error: articleError } = await context.supabase
    .from("articles")
    .select("id, cover_image_url, cover_image_storage_path, hero_video_url, hero_video_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (articleError) {
    return NextResponse.json({ error: articleError.message }, { status: 400 });
  }

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const { error: deleteError } = await context.supabase
    .from("articles")
    .delete()
    .eq("id", id);

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
      supabase: context.supabase,
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
