import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type CommentKind = "article" | "project" | "poll";

type CommentConfig = {
  commentTable: string;
  contentTable: string;
  /** Column on the comment row that references its parent content. */
  contentFk: string;
  /** Column on the content table that holds the owner's user id. */
  ownerColumn: string;
};

const CONFIG: Record<CommentKind, CommentConfig> = {
  article: {
    commentTable: "article_comments",
    contentTable: "articles",
    contentFk: "article_id",
    ownerColumn: "author_user_id",
  },
  project: {
    commentTable: "project_comments",
    contentTable: "projects",
    contentFk: "project_id",
    ownerColumn: "owner_id",
  },
  poll: {
    commentTable: "poll_comments",
    contentTable: "polls",
    contentFk: "poll_id",
    ownerColumn: "author_user_id",
  },
};

export type DeleteCommentResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Deletes a comment if the caller is allowed to: the comment's author, the
 * owner of the parent content (project/article/poll), or a platform admin.
 *
 * Comment RLS only lets the author (or an admin) delete, so the content-owner
 * case is performed with the service-role client. Deleting a top-level comment
 * cascades to its replies via the parent_id foreign key. Reads use the
 * request-scoped client; only the final delete is privileged.
 */
export async function deleteCommentAuthorized(params: {
  kind: CommentKind;
  contentId: string;
  commentId: string;
  userId: string;
  isAdmin: boolean;
  client: SupabaseClient;
}): Promise<DeleteCommentResult> {
  const cfg = CONFIG[params.kind];

  const { data: comment } = await params.client
    .from(cfg.commentTable)
    .select("*")
    .eq("id", params.commentId)
    .maybeSingle();

  // 404 if the comment is missing or does not belong to the named content
  // (prevents deleting a comment by pairing it with the wrong content id).
  if (!comment || comment[cfg.contentFk] !== params.contentId) {
    return { ok: false, status: 404, error: "Comment not found" };
  }

  const { data: content } = await params.client
    .from(cfg.contentTable)
    .select("*")
    .eq("id", params.contentId)
    .maybeSingle();

  const ownerId = (content?.[cfg.ownerColumn] as string | null) ?? null;
  const isAuthor = comment.author_user_id === params.userId;
  const isOwner = ownerId !== null && ownerId === params.userId;

  if (!isAuthor && !isOwner && !params.isAdmin) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  // Service role bypasses the author-only RLS so an owner/admin can remove
  // someone else's comment. Falls back to the request client (author/admin
  // self-delete still works under RLS) if the service role is unavailable.
  const deleteClient = createAdminClient() ?? params.client;
  const { error } = await deleteClient
    .from(cfg.commentTable)
    .delete()
    .eq("id", params.commentId);

  if (error) {
    return { ok: false, status: 400, error: error.message || "Delete failed" };
  }

  return { ok: true };
}
