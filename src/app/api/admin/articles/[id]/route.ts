import { NextResponse } from "next/server";
import { getCurrentViewerRole } from "@/lib/moderation-server";
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
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (articleError) {
    return NextResponse.json({ error: articleError.message }, { status: 400 });
  }

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // Into the trash for 60 days (a database trigger); the files stay in
  // storage until the trash is emptied, so the article can be restored.
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

  return NextResponse.json({ success: true });
}
