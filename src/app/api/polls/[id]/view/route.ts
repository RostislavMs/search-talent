import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
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

  const { data: poll } = await supabase
    .from("polls")
    .select("id, status, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!poll || poll.status !== "published" || !isPublicModerationStatus(poll.moderation_status)) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  // One view per authenticated user: the SECURITY DEFINER RPC dedupes via the
  // poll_views table and bumps the denormalized counter only on a viewer's
  // first view. Anonymous viewers are not counted; author self-views are
  // filtered out client-side.
  const { data: viewsCount, error } = await supabase.rpc("record_poll_view", {
    p_poll_id: id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ viewsCount: viewsCount ?? null });
}
