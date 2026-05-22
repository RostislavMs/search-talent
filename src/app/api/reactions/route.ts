import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findReactionTargetAuthor,
  getReactionsForTargets,
  toggleReaction,
} from "@/lib/db/reactions";
import { createNotifications } from "@/lib/db/notifications";
import {
  reactionBulkQuerySchema,
  reactionPayloadSchema,
} from "@/lib/validation/reactions";
import { parseJsonRequest } from "@/lib/validation/request";

/**
 * POST /api/reactions — toggle a single reaction for the current user.
 * Body: { target_type, target_id, emoji }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`reaction:${user.id}`, 60, 60_000);
  if (limited) return limited;

  const parsed = await parseJsonRequest(request, reactionPayloadSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { target_type, target_id, emoji } = parsed.data;

  let result: { active: boolean };
  try {
    result = await toggleReaction(supabase, {
      userId: user.id,
      targetType: target_type,
      targetId: target_id,
      emoji,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update reaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const reactions = await getReactionsForTargets(supabase, {
    targetType: target_type,
    targetIds: [target_id],
    viewerUserId: user.id,
  });

  // Fire-and-forget notification on activation (not on un-reaction).
  if (result.active) {
    void notifyTargetAuthor({
      actorUserId: user.id,
      targetType: target_type,
      targetId: target_id,
      emoji,
    }).catch((err) => {
      console.error("[reactions] notify failed", err);
    });
  }

  return NextResponse.json({
    active: result.active,
    reactions: reactions[target_id] ?? [],
  });
}

/**
 * GET /api/reactions?target_type=...&ids=uuid1,uuid2,...
 * Returns a map of target_id → ReactionSummary[].
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const target_type = searchParams.get("target_type");
  const idsParam = searchParams.get("ids");
  const target_ids = idsParam ? idsParam.split(",").filter(Boolean) : [];

  const parsed = reactionBulkQuerySchema.safeParse({ target_type, target_ids });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid query" },
      { status: 400 },
    );
  }

  const reactions = await getReactionsForTargets(supabase, {
    targetType: parsed.data.target_type,
    targetIds: parsed.data.target_ids,
    viewerUserId: user?.id ?? null,
  });

  return NextResponse.json({ reactions });
}

async function notifyTargetAuthor(params: {
  actorUserId: string;
  targetType: "project_comment" | "article_comment" | "article";
  targetId: string;
  emoji: string;
}) {
  const admin = createAdminClient();
  if (!admin) return;

  const recipient = await findReactionTargetAuthor(admin, {
    targetType: params.targetType,
    targetId: params.targetId,
  });

  if (!recipient || recipient === params.actorUserId) return;

  await createNotifications(admin, {
    recipientUserId: recipient,
    actorUserId: params.actorUserId,
    type: "reaction",
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: { emoji: params.emoji },
  });
}
