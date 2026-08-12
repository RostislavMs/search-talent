import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import {
  COMMENT_KINDS,
  getCommentTable,
  type CommentKind,
} from "@/lib/db/comment-moderation";

const itemSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(COMMENT_KINDS),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(200),
});

export async function POST(request: Request) {
  const context = await getCurrentViewerRole();
  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }

  // Group by kind rather than branching per kind, so a new commentable type is
  // covered by adding it to COMMENT_KINDS and nothing else.
  const idsByKind = new Map<CommentKind, string[]>();
  for (const item of parsed.data.items) {
    const bucket = idsByKind.get(item.kind) ?? [];
    bucket.push(item.id);
    idsByKind.set(item.kind, bucket);
  }

  const { supabase } = context;

  for (const [kind, ids] of idsByKind) {
    const { error } = await supabase
      .from(getCommentTable(kind))
      .delete()
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Delete failed" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    deleted: parsed.data.items.length,
  });
}
