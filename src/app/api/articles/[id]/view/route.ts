import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import { routeArticleIdSchema } from "@/lib/validation/articles";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeArticleIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.issues[0]?.message || "Invalid article id" }, { status: 400 });
  }

  const { id } = routeParams.data;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("articles")
    .select("id, status, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!article || article.status !== "published" || !isPublicModerationStatus(article.moderation_status)) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // One view per authenticated user: the SECURITY DEFINER RPC dedupes via the
  // article_views table and bumps the denormalized counter only on a viewer's
  // first view. Anonymous viewers are not counted (the RPC echoes the current
  // total for them). Author self-views are filtered out client-side.
  const { data: viewsCount, error } = await supabase.rpc("record_article_view", {
    p_article_id: id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ viewsCount: viewsCount ?? null });
}
