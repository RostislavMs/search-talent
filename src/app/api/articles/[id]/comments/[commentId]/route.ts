import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { deleteCommentAuthorized } from "@/lib/db/comment-moderation";

const paramsSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
});

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const context = await getCurrentViewerRole();

  if (!context.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = paramsSchema.safeParse(await params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  const result = await deleteCommentAuthorized({
    kind: "article",
    contentId: parsed.data.id,
    commentId: parsed.data.commentId,
    userId: context.user.id,
    isAdmin: context.isAdmin,
    client: context.supabase,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
