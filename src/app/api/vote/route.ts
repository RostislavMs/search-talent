import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { LEADERBOARDS_CACHE_TAG } from "@/lib/db/leaderboards";
import { getProjectVoteSummary } from "@/lib/db/project-votes";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";
import { projectVoteSchema } from "@/lib/validation/vote";
import { getWilsonScore } from "@/lib/leaderboards";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Please verify your email before voting" },
      { status: 403 },
    );
  }

  const limited = await dbRateLimit(supabase, `vote:${user.id}`, 20, 60_000);

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, projectVoteSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { projectId, value } = parsed.data;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 400 });
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.owner_id === user.id) {
    return NextResponse.json(
      { error: "You cannot vote on your own project" },
      { status: 400 },
    );
  }

  const { data: existingVotes, error: existingVoteError } = await supabase
    .from("votes")
    .select("value")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .limit(1);

  if (existingVoteError) {
    return NextResponse.json(
      { error: existingVoteError.message },
      { status: 400 },
    );
  }

  const existingVote = existingVotes?.[0] ?? null;

  if (existingVote?.value === value) {
    const { error: deleteError } = await supabase
      .from("votes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }
  } else if (existingVote) {
    const { error: updateError } = await supabase
      .from("votes")
      .update({ value })
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }
  } else {
    const { error: insertError } = await supabase.from("votes").insert({
      project_id: projectId,
      user_id: user.id,
      value,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  const summary = await getProjectVoteSummary(supabase, projectId, user.id);

  // Persist a Wilson-based score (0-100 scale) so search sorting reflects
  // vote confidence, not just raw likes minus dislikes.
  const wilsonScore = Math.round(
    getWilsonScore(summary.likes, summary.dislikes) * 100,
  );
  const { error: scoreError } = await supabase
    .from("projects")
    .update({ score: wilsonScore })
    .eq("id", projectId);

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 400 });
  }

  revalidateTag(LEADERBOARDS_CACHE_TAG, "max");

  return NextResponse.json({ success: true, ...summary });
}
