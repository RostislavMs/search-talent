import { NextResponse } from "next/server";
import { emailModerationDecisions, moderateContent } from "@/lib/db/moderation-actions";
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

  // The database stamps who and when, logs the decision and notifies the
  // author; a hidden article is also e-mailed to them from here.
  const note = parsed.data.moderation_note;
  const result = await moderateContent(context.supabase, {
    targetType: "article",
    targetIds: [routeParams.data.id],
    status: parsed.data.moderation_status,
    note,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.items.length === 0) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  await emailModerationDecisions({ targetType: "article", items: result.items, note });

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
