import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { routePollIdSchema } from "@/lib/validation/polls";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routePollIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid poll id" },
      { status: 400 },
    );
  }

  const { id } = routeParams.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`poll-like:${user.id}`, 30, 60_000);
  if (limited) {
    return limited;
  }

  const { data: poll } = await supabase
    .from("polls")
    .select("id, status, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!poll || poll.status !== "published" || !isPublicModerationStatus(poll.moderation_status)) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  const { data: existingLike } = await supabase
    .from("poll_likes")
    .select("poll_id")
    .eq("poll_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingLike) {
    const { error } = await supabase
      .from("poll_likes")
      .delete()
      .eq("poll_id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } else {
    const { error } = await supabase.from("poll_likes").insert({
      poll_id: id,
      user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const { data: counts } = await supabase
    .from("polls")
    .select("likes_count")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({
    liked: !existingLike,
    likesCount: counts?.likes_count ?? 0,
  });
}
