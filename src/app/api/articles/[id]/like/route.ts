import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`article-like:${user.id}`, 30, 60_000);

  if (limited) {
    return limited;
  }

  const { data: article } = await supabase
    .from("articles")
    .select("id, status, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!article || article.status !== "published" || !isPublicModerationStatus(article.moderation_status)) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const { data: existingLike } = await supabase
    .from("article_likes")
    .select("article_id")
    .eq("article_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingLike) {
    const { error } = await supabase
      .from("article_likes")
      .delete()
      .eq("article_id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } else {
    const { error } = await supabase.from("article_likes").insert({
      article_id: id,
      user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // Read the denormalized counter (maintained by trigger) — a single PK lookup
  // instead of counting every like row for the article.
  const { data: counts } = await supabase
    .from("articles")
    .select("likes_count")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    liked: !existingLike,
    likesCount: counts?.likes_count ?? 0,
  });
}
