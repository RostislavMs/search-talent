import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { LEADERBOARDS_CACHE_TAG } from "@/lib/db/leaderboards";
import { getProfileVoteSummary } from "@/lib/db/profile-votes";
import { dbRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/validation/request";
import { profileVoteSchema } from "@/lib/validation/vote";
import { getWilsonScore } from "@/lib/leaderboards";

function getProfileVoteErrorMessage(message: string) {
  if (message.includes("Could not find the table 'public.profile_votes'")) {
    return "Profile rating is not configured yet. Run the profile_votes SQL migration first.";
  }

  return message;
}

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

  const limited = await dbRateLimit(
    supabase,
    `profile-vote:${user.id}`,
    20,
    60_000,
  );

  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, profileVoteSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { profileId, value } = parsed.data;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.user_id === user.id) {
    return NextResponse.json(
      { error: "You cannot rate your own profile" },
      { status: 400 },
    );
  }

  const { data: existingVotes, error: existingVoteError } = await supabase
    .from("profile_votes")
    .select("value")
    .eq("profile_id", profileId)
    .eq("user_id", user.id)
    .limit(1);

  if (existingVoteError) {
    return NextResponse.json(
      { error: getProfileVoteErrorMessage(existingVoteError.message) },
      { status: 400 },
    );
  }

  const existingVote = existingVotes?.[0] ?? null;

  if (existingVote?.value === value) {
    const { error: deleteError } = await supabase
      .from("profile_votes")
      .delete()
      .eq("profile_id", profileId)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: getProfileVoteErrorMessage(deleteError.message) },
        { status: 400 },
      );
    }
  } else if (existingVote) {
    const { error: updateError } = await supabase
      .from("profile_votes")
      .update({ value })
      .eq("profile_id", profileId)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: getProfileVoteErrorMessage(updateError.message) },
        { status: 400 },
      );
    }
  } else {
    const { error: insertError } = await supabase.from("profile_votes").insert({
      profile_id: profileId,
      user_id: user.id,
      value,
    });

    if (insertError) {
      return NextResponse.json(
        { error: getProfileVoteErrorMessage(insertError.message) },
        { status: 400 },
      );
    }
  }

  const summary = await getProfileVoteSummary(supabase, profileId, user.id);

  // Persist a lightweight score (Wilson-based, 0-100 scale) so search can
  // sort profiles by rating without recomputing the full leaderboard score.
  const wilsonScore = Math.round(
    getWilsonScore(summary.likes, summary.dislikes) * 100,
  );
  await supabase
    .from("profiles")
    .update({ score: wilsonScore })
    .eq("id", profileId);

  revalidateTag(LEADERBOARDS_CACHE_TAG, "max");

  return NextResponse.json({ success: true, ...summary });
}
