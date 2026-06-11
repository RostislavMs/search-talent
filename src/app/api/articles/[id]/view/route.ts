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

  // Atomic, RLS-safe increment. Anonymous viewers can no longer write to the articles
  // table directly (articles_update_compat is now author/admin only), so the count is
  // bumped through a SECURITY DEFINER RPC that only ever touches views_count on a
  // publicly visible article. This also fixes the previous lost-update race.
  const { data: viewsCount, error } = await supabase.rpc("increment_article_views", {
    p_article_id: id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ viewsCount: viewsCount ?? null });
}
