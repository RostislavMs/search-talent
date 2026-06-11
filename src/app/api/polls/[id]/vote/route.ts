import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getPollResults } from "@/lib/db/polls";
import { pollVotePayloadSchema, routePollIdSchema } from "@/lib/validation/polls";
import { parseJsonRequest } from "@/lib/validation/request";

export async function POST(
  request: Request,
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

  const limited = rateLimit(`poll-vote:${user.id}`, 30, 60_000);
  if (limited) {
    return limited;
  }

  const parsed = await parseJsonRequest(request, pollVotePayloadSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // All validation (poll open, type rules, option ownership, atomic re-vote)
  // happens inside the SECURITY DEFINER RPC — the only writer of the ballot
  // tables. A failed rule rolls the whole vote back.
  const { error } = await supabase.rpc("cast_poll_vote", {
    p_poll_id: id,
    p_answers: parsed.data.answers,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const results = await getPollResults(supabase, id, user.id);

  return NextResponse.json({ success: true, results });
}
