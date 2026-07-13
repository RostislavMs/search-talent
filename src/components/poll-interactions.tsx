"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import CommentDeleteButton from "@/components/comment-delete-button";
import CommentGif from "@/components/ui/comment-gif";
import FormTextarea from "@/components/ui/form-textarea";
import GifPicker from "@/components/ui/gif-picker";
import OptimizedImage from "@/components/ui/optimized-image";
import {
  CommentIcon,
  EyeIcon,
  LikeChip,
  StatChip,
} from "@/components/ui/content-stats";
import { apiFetch } from "@/lib/api-client";
import { createLocalePath } from "@/lib/i18n/config";
import type { PollComment } from "@/lib/polls";

function countComments(comments: PollComment[]): number {
  return comments.reduce((sum, comment) => sum + 1 + countComments(comment.replies), 0);
}

function formatCommentDate(value: string | null, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const MAX_INDENT_DEPTH = 3;

function pluralizeReplies(count: number, locale: string, hide: boolean) {
  if (locale === "uk") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    let noun: string;
    if (mod10 === 1 && mod100 !== 11) noun = "відповідь";
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) noun = "відповіді";
    else noun = "відповідей";
    return hide ? `Сховати ${count} ${noun}` : `${count} ${noun}`;
  }
  const noun = count === 1 ? "reply" : "replies";
  return hide ? `Hide ${count} ${noun}` : `${count} ${noun}`;
}

function CommentNode({
  comment,
  depth,
  locale,
  canComment,
  replyLabel,
  replyPlaceholder,
  sendLabel,
  replyingTo,
  setReplyingTo,
  replyDrafts,
  setReplyDrafts,
  replyMediaDrafts,
  setReplyMediaDrafts,
  submittingFor,
  submitReply,
  replyError,
  gifEnabled,
  removeGifLabel,
  pollId,
  viewerUserId,
  ownerUserId,
  onDeleted,
}: {
  comment: PollComment;
  depth: number;
  locale: string;
  canComment: boolean;
  replyLabel: string;
  replyPlaceholder: string;
  sendLabel: string;
  replyingTo: string | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<string | null>>;
  replyDrafts: Record<string, string>;
  setReplyDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  replyMediaDrafts: Record<string, string | null>;
  setReplyMediaDrafts: React.Dispatch<
    React.SetStateAction<Record<string, string | null>>
  >;
  submittingFor: string | null;
  submitReply: (parentId: string) => void;
  replyError: string | null;
  gifEnabled: boolean;
  removeGifLabel: string;
  pollId: string;
  viewerUserId: string | null;
  ownerUserId: string | null;
  onDeleted: () => void;
}) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const replyCount = comment.replies.length;
  const showIndent = depth < MAX_INDENT_DEPTH;
  const canDelete =
    Boolean(viewerUserId) &&
    (comment.authorUserId === viewerUserId || viewerUserId === ownerUserId);
  const authorName = comment.authorDeleted
    ? locale === "uk"
      ? "Видалений користувач"
      : "Deleted user"
    : comment.author?.name || comment.author?.username || (locale === "uk" ? "Користувач" : "User");

  return (
    <article id={`comment-${comment.id}`} className="flex gap-2 sm:gap-3">
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[color:var(--surface-muted)] sm:h-8 sm:w-8">
        {comment.author?.avatarUrl ? (
          <OptimizedImage
            src={comment.author.avatarUrl}
            alt={authorName}
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="break-words text-sm font-semibold text-[color:var(--foreground)]">
            {authorName}
          </span>
          {comment.createdAt ? (
            <span className="text-xs app-soft">{formatCommentDate(comment.createdAt, locale)}</span>
          ) : null}
        </header>

        {comment.body ? (
          <p className="mt-0.5 block break-words whitespace-pre-line text-sm leading-snug text-[color:var(--foreground)] sm:mt-1 sm:leading-6">
            {comment.body}
          </p>
        ) : null}

        {comment.mediaUrl ? <CommentGif url={comment.mediaUrl} /> : null}

        {canComment || canDelete ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-2.5">
            {canComment ? (
              <button
                type="button"
                className="cursor-pointer text-xs font-medium app-soft transition-colors hover:text-[color:var(--foreground)]"
                onClick={() => setReplyingTo((prev) => (prev === comment.id ? null : comment.id))}
              >
                {replyLabel}
              </button>
            ) : null}
            {canDelete ? (
              <CommentDeleteButton
                endpoint={`/api/polls/${pollId}/comments/${comment.id}`}
                locale={locale}
                onDeleted={onDeleted}
              />
            ) : null}
          </div>
        ) : null}

        {replyingTo === comment.id ? (
          <div className="mt-3 space-y-2">
            <FormTextarea
              className="min-h-20 w-full bg-[color:var(--surface-muted)] p-3 text-sm"
              placeholder={replyPlaceholder}
              value={replyDrafts[comment.id] || ""}
              onChange={(event) =>
                setReplyDrafts((prev) => ({ ...prev, [comment.id]: event.target.value }))
              }
            />
            {replyMediaDrafts[comment.id] ? (
              <div className="relative inline-block">
                <CommentGif url={replyMediaDrafts[comment.id]!} className="mt-0 block max-h-48 w-auto max-w-full rounded-xl border app-border" />
                <button
                  type="button"
                  onClick={() =>
                    setReplyMediaDrafts((prev) => ({ ...prev, [comment.id]: null }))
                  }
                  aria-label={removeGifLabel}
                  className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                >
                  ×
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => submitReply(comment.id)}
                disabled={
                  submittingFor === comment.id ||
                  (!replyDrafts[comment.id]?.trim() &&
                    !replyMediaDrafts[comment.id])
                }
              >
                {sendLabel}
              </Button>
              <GifPicker
                enabled={gifEnabled}
                onSelect={(gif) =>
                  setReplyMediaDrafts((prev) => ({
                    ...prev,
                    [comment.id]: gif.url,
                  }))
                }
                disabled={submittingFor === comment.id}
              />
            </div>
            {replyError ? (
              <p className="text-sm text-rose-500" role="alert">
                {replyError}
              </p>
            ) : null}
          </div>
        ) : null}

        {replyCount > 0 && (
          <div className="mt-2 sm:mt-3">
            <button
              type="button"
              onClick={() => setRepliesOpen((open) => !open)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:opacity-70"
              aria-expanded={repliesOpen}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className={`transition-transform ${repliesOpen ? "rotate-180" : ""}`}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{pluralizeReplies(replyCount, locale, repliesOpen)}</span>
            </button>

            {repliesOpen && (
              <div
                className={
                  showIndent
                    ? "mt-3 space-y-4 border-l app-border pl-2.5 sm:mt-4 sm:space-y-5 sm:pl-4"
                    : "mt-3 space-y-4 sm:mt-4 sm:space-y-5"
                }
              >
                {comment.replies.map((child) => (
                  <CommentNode
                    key={child.id}
                    comment={child}
                    depth={depth + 1}
                    locale={locale}
                    canComment={canComment}
                    replyLabel={replyLabel}
                    replyPlaceholder={replyPlaceholder}
                    sendLabel={sendLabel}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyDrafts={replyDrafts}
                    setReplyDrafts={setReplyDrafts}
                    replyMediaDrafts={replyMediaDrafts}
                    setReplyMediaDrafts={setReplyMediaDrafts}
                    submittingFor={submittingFor}
                    submitReply={submitReply}
                    replyError={replyError}
                    gifEnabled={gifEnabled}
                    removeGifLabel={removeGifLabel}
                    pollId={pollId}
                    viewerUserId={viewerUserId}
                    ownerUserId={ownerUserId}
                    onDeleted={onDeleted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function PollInteractions({
  locale,
  pollId,
  initialLikesCount,
  initialViewsCount,
  initialLiked,
  comments,
  isAuthenticated,
  viewerUserId,
  ownerUserId,
  gifEnabled,
}: {
  locale: string;
  pollId: string;
  initialLikesCount: number;
  initialViewsCount: number;
  initialLiked: boolean;
  comments: PollComment[];
  isAuthenticated: boolean;
  viewerUserId: string | null;
  ownerUserId: string | null;
  gifEnabled: boolean;
}) {
  const router = useRouter();
  const loginPath = createLocalePath(locale === "uk" ? "uk" : "en", "/login");
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [viewsCount, setViewsCount] = useState(initialViewsCount);
  const [liked, setLiked] = useState(initialLiked);
  const [commentBody, setCommentBody] = useState("");
  const [commentMedia, setCommentMedia] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingLike, setSubmittingLike] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyMediaDrafts, setReplyMediaDrafts] = useState<
    Record<string, string | null>
  >({});
  const [submittingFor, setSubmittingFor] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const totalCommentCount = countComments(comments);

  useEffect(() => {
    const storageKey = `poll-viewed:${pollId}`;
    if (window.localStorage.getItem(storageKey)) return;
    void apiFetch<{ viewsCount?: number }>(`/api/polls/${pollId}/view`, {
      method: "POST",
    }).then((result) => {
      if (result.ok && result.data.viewsCount) {
        setViewsCount(result.data.viewsCount);
        window.localStorage.setItem(storageKey, "1");
      }
    });
  }, [pollId]);

  const toggleLike = async () => {
    if (!isAuthenticated) {
      router.push(loginPath);
      return;
    }
    setSubmittingLike(true);
    const result = await apiFetch<{ liked?: boolean; likesCount?: number }>(
      `/api/polls/${pollId}/like`,
      { method: "POST" },
    );
    setSubmittingLike(false);
    if (!result.ok) return;
    setLiked(Boolean(result.data.liked));
    setLikesCount(result.data.likesCount ?? likesCount);
  };

  const submitComment = async () => {
    const body = commentBody.trim();
    if ((!body && !commentMedia) || !isAuthenticated) {
      if (!isAuthenticated) router.push(loginPath);
      return;
    }
    setSubmittingComment(true);
    setCommentError(null);
    const result = await apiFetch(`/api/polls/${pollId}/comments`, {
      method: "POST",
      body: { body, media_url: commentMedia, parent_id: null },
    });
    setSubmittingComment(false);
    if (!result.ok) {
      setCommentError(
        result.error ||
          (locale === "uk"
            ? "Не вдалося опублікувати коментар."
            : "Could not post the comment."),
      );
      return;
    }
    setCommentBody("");
    setCommentMedia(null);
    router.refresh();
  };

  const submitReply = async (parentId: string) => {
    const body = replyDrafts[parentId]?.trim() || "";
    const media = replyMediaDrafts[parentId] || null;
    if (!body && !media) return;
    setSubmittingFor(parentId);
    setReplyError(null);
    const result = await apiFetch(`/api/polls/${pollId}/comments`, {
      method: "POST",
      body: { body, media_url: media, parent_id: parentId },
    });
    setSubmittingFor(null);
    if (!result.ok) {
      setReplyError(
        result.error ||
          (locale === "uk"
            ? "Не вдалося опублікувати відповідь."
            : "Could not post the reply."),
      );
      return;
    }
    setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
    setReplyMediaDrafts((prev) => ({ ...prev, [parentId]: null }));
    setReplyingTo(null);
    router.refresh();
  };

  const isUk = locale === "uk";
  const removeGifLabel = isUk ? "Прибрати GIF" : "Remove GIF";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <LikeChip
          liked={liked}
          count={likesCount}
          onClick={() => void toggleLike()}
          disabled={submittingLike}
          label={isUk ? "Подобається" : "Like"}
        />
        <StatChip
          icon={<EyeIcon />}
          count={viewsCount}
          label={isUk ? "Перегляди" : "Views"}
        />
        <StatChip
          icon={<CommentIcon />}
          count={totalCommentCount}
          label={isUk ? "Коментарі" : "Comments"}
        />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {isUk ? "Обговорення" : "Discussion"}
          </h2>
        </div>

        <div className="rounded-panel app-card p-5">
          <FormTextarea
            className="min-h-28 w-full bg-[color:var(--surface-muted)] p-4 text-sm"
            placeholder={isUk ? "Поділіться думкою про опитування..." : "Share your thoughts about the poll..."}
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
          />
          {commentMedia ? (
            <div className="relative mt-3 inline-block">
              <CommentGif url={commentMedia} className="mt-0 block max-h-48 w-auto max-w-full rounded-xl border app-border" />
              <button
                type="button"
                onClick={() => setCommentMedia(null)}
                aria-label={removeGifLabel}
                className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                ×
              </button>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <GifPicker
              enabled={gifEnabled}
              onSelect={(gif) => setCommentMedia(gif.url)}
              disabled={submittingComment}
            />
            <Button
              onClick={() => void submitComment()}
              disabled={submittingComment || (!commentBody.trim() && !commentMedia)}
            >
              {isUk ? "Опублікувати коментар" : "Post comment"}
            </Button>
          </div>
          {commentError ? (
            <p className="mt-3 text-sm text-rose-500" role="alert">
              {commentError}
            </p>
          ) : null}
        </div>

        {comments.length > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {comments.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                depth={0}
                locale={locale}
                canComment={isAuthenticated}
                replyLabel={isUk ? "Відповісти" : "Reply"}
                replyPlaceholder={isUk ? "Напишіть відповідь..." : "Write a reply..."}
                sendLabel={isUk ? "Надіслати" : "Send"}
                replyingTo={replyingTo}
                setReplyingTo={(value) => {
                  setReplyError(null);
                  setReplyingTo(value);
                }}
                replyDrafts={replyDrafts}
                setReplyDrafts={setReplyDrafts}
                replyMediaDrafts={replyMediaDrafts}
                setReplyMediaDrafts={setReplyMediaDrafts}
                submittingFor={submittingFor}
                submitReply={(id) => void submitReply(id)}
                replyError={replyError}
                gifEnabled={gifEnabled}
                removeGifLabel={removeGifLabel}
                pollId={pollId}
                viewerUserId={viewerUserId}
                ownerUserId={ownerUserId}
                onDeleted={() => router.refresh()}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-3xl app-panel-dashed p-5 text-sm app-muted">
            {isUk
              ? "Поки що коментарів немає. Можна почати обговорення першим."
              : "No comments yet. Start the discussion first."}
          </p>
        )}
      </section>
    </div>
  );
}
