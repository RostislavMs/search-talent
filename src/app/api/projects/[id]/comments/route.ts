import { NextResponse } from "next/server";
import { isPublicModerationStatus } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";
import {
  projectCommentPayloadSchema,
  routeProjectIdSchema,
} from "@/lib/validation/project";
import { parseJsonRequest } from "@/lib/validation/request";
import { dispatchCommentSideEffects } from "@/lib/db/comment-events";
import { getReactionsForTargets } from "@/lib/db/reactions";
import {
  describeModerationResult,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import { getRequestLocale } from "@/lib/i18n/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeProjectIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid project id" },
      { status: 400 },
    );
  }

  const { id } = routeParams.data;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!project || !isPublicModerationStatus(project.moderation_status)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: comments, error } = await supabase
    .from("project_comments")
    .select(
      "id, project_id, author_user_id, parent_id, body, created_at, updated_at",
    )
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const authorIds = [
    ...new Set(
      (comments || [])
        .map((c) => c.author_user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let authors: Record<
    string,
    { username: string | null; name: string | null; avatar_url: string | null }
  > = {};

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, name, avatar_url")
      .in("user_id", authorIds);

    if (profiles) {
      authors = Object.fromEntries(
        profiles.map((p) => [
          p.user_id,
          {
            username: p.username,
            name: p.name,
            avatar_url: p.avatar_url,
          },
        ]),
      );
    }
  }

  const commentIds = (comments || []).map((c) => c.id);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const reactionsMap = await getReactionsForTargets(supabase, {
    targetType: "project_comment",
    targetIds: commentIds,
    viewerUserId: user?.id ?? null,
  });

  const enriched = (comments || []).map((c) => ({
    ...c,
    author_deleted: c.author_user_id === null,
    author: (c.author_user_id && authors[c.author_user_id]) || {
      username: null,
      name: null,
      avatar_url: null,
    },
    reactions: reactionsMap[c.id] || [],
  }));

  return NextResponse.json({ comments: enriched });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = routeProjectIdSchema.safeParse(await params);

  if (!routeParams.success) {
    return NextResponse.json(
      { error: routeParams.error.issues[0]?.message || "Invalid project id" },
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

  const parsed = await parseJsonRequest(request, projectCommentPayloadSchema);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Comments have no review pipeline, so a flagged comment is rejected outright
  // with a precise, localized explanation the author can act on.
  const screen = screenContentForModeration([parsed.data.body]);
  if (screen.flagged) {
    return NextResponse.json(
      {
        error: describeModerationResult(screen, await getRequestLocale()),
        code: "moderation_blocked",
      },
      { status: 400 },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id, moderation_status")
    .eq("id", id)
    .maybeSingle();

  if (!project || !isPublicModerationStatus(project.moderation_status)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let parentAuthorUserId: string | null = null;
  if (parsed.data.parent_id) {
    const { data: parent } = await supabase
      .from("project_comments")
      .select("author_user_id")
      .eq("id", parsed.data.parent_id)
      .maybeSingle();
    parentAuthorUserId = parent?.author_user_id ?? null;
  }

  const { data: inserted, error } = await supabase
    .from("project_comments")
    .insert({
      project_id: id,
      author_user_id: user.id,
      parent_id: parsed.data.parent_id,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message || "Failed to create comment" },
      { status: 400 },
    );
  }

  void dispatchCommentSideEffects({
    sourceType: "project_comment",
    commentId: inserted.id,
    body: parsed.data.body,
    authorUserId: user.id,
    parentAuthorUserId,
    contentOwnerUserId: project.owner_id ?? null,
    metadata: {
      projectId: id,
      excerpt: parsed.data.body.slice(0, 160),
    },
  });

  return NextResponse.json({ success: true, id: inserted.id });
}
