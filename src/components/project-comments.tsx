"use client";

import Image from "next/image";
import { startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import MentionText from "@/components/ui/mention-text";
import MentionTextarea from "@/components/ui/mention-textarea";
import ReactionPicker from "@/components/ui/reaction-picker";
import { apiFetch } from "@/lib/api-client";
import type { ReactionSummary } from "@/lib/constants/reactions";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

type Comment = {
  id: string;
  project_id: string;
  author_user_id: string | null;
  parent_id: string | null;
  body: string;
  created_at: string;
  author_deleted?: boolean;
  author: {
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
  reactions?: ReactionSummary[];
};

type ProjectCommentsProps = {
  projectId: string;
  isAuthenticated: boolean;
};

function formatRelativeTime(isoDate: string, locale: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return locale === "uk" ? "щойно" : "just now";
  }

  if (diffMinutes < 60) {
    return locale === "uk"
      ? `${diffMinutes} хв тому`
      : `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return locale === "uk"
      ? `${diffHours} год тому`
      : `${diffHours}h ago`;
  }

  if (diffDays < 30) {
    return locale === "uk" ? `${diffDays} дн тому` : `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

function pluralizeReplies(count: number, locale: string, hide: boolean) {
  if (locale === "uk") {
    const mod10 = count % 10;
    const mod100 = count % 100;
    let noun: string;
    if (mod10 === 1 && mod100 !== 11) noun = "відповідь";
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
      noun = "відповіді";
    else noun = "відповідей";
    return hide ? `Сховати ${count} ${noun}` : `${count} ${noun}`;
  }

  const noun = count === 1 ? "reply" : "replies";
  return hide ? `Hide ${count} ${noun}` : `${count} ${noun}`;
}

function buildCommentTree(comments: Comment[]) {
  const topLevel: Comment[] = [];
  const childrenMap = new Map<string, Comment[]>();

  for (const comment of comments) {
    if (comment.parent_id) {
      const siblings = childrenMap.get(comment.parent_id) || [];
      siblings.push(comment);
      childrenMap.set(comment.parent_id, siblings);
    } else {
      topLevel.push(comment);
    }
  }

  return { topLevel, childrenMap };
}

const MAX_INDENT_DEPTH = 3;

function CommentItem({
  comment,
  childrenMap,
  depth,
  locale,
  isAuthenticated,
  onReply,
  replyingTo,
  replyBody,
  onReplyBodyChange,
  onSubmitReply,
  submitting,
  dictionary,
}: {
  comment: Comment;
  childrenMap: Map<string, Comment[]>;
  depth: number;
  locale: string;
  isAuthenticated: boolean;
  onReply: (id: string | null) => void;
  replyingTo: string | null;
  replyBody: string;
  onReplyBodyChange: (value: string) => void;
  onSubmitReply: () => void;
  submitting: boolean;
  dictionary: ReturnType<typeof useDictionary>;
}) {
  const [repliesOpen, setRepliesOpen] = useState(false);

  const authorName = comment.author_deleted
    ? dictionary.projectComments.deletedUser
    : comment.author.name ||
      comment.author.username ||
      dictionary.projectComments.anonymous;

  const replies = childrenMap.get(comment.id);
  const replyCount = replies?.length ?? 0;
  const showIndent = depth < MAX_INDENT_DEPTH;
  const nextDepth = depth + 1;

  return (
    <article id={`comment-${comment.id}`} className="flex gap-2 sm:gap-3">
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full app-panel text-xs font-semibold text-[color:var(--foreground)] sm:h-8 sm:w-8">
        {comment.author.avatar_url ? (
          <Image
            src={comment.author.avatar_url}
            alt={authorName}
            fill
            className="object-cover"
            sizes="32px"
          />
        ) : (
          <span>{authorName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-baseline gap-x-2 leading-tight">
          <span className="break-words text-sm font-semibold text-[color:var(--foreground)]">
            {authorName}
          </span>
          <span className="text-xs app-soft">
            {formatRelativeTime(comment.created_at, locale)}
          </span>
        </header>

        <MentionText
          body={comment.body}
          className="mt-0.5 block break-words whitespace-pre-line text-sm leading-snug text-[color:var(--foreground)] sm:mt-1 sm:leading-6"
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-2.5">
          <ReactionPicker
            targetType="project_comment"
            targetId={comment.id}
            initialReactions={comment.reactions || []}
            isAuthenticated={isAuthenticated}
            size="sm"
          />

          {isAuthenticated && (
            <button
              type="button"
              onClick={() =>
                onReply(replyingTo === comment.id ? null : comment.id)
              }
              className="cursor-pointer text-xs font-medium app-soft transition-colors hover:text-[color:var(--foreground)]"
            >
              {dictionary.projectComments.reply}
            </button>
          )}
        </div>

        {replyingTo === comment.id && (
          <div className="mt-3 space-y-2">
            <MentionTextarea
              value={replyBody}
              onChange={onReplyBodyChange}
              placeholder={dictionary.projectComments.replyPlaceholder}
              rows={2}
              className="w-full resize-none rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={onSubmitReply}
                disabled={submitting || !replyBody.trim()}
                size="sm"
              >
                {submitting
                  ? dictionary.projectComments.sending
                  : dictionary.projectComments.send}
              </Button>
              <Button
                onClick={() => onReply(null)}
                variant="ghost"
                size="sm"
              >
                {dictionary.projectComments.cancel}
              </Button>
            </div>
          </div>
        )}

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
                {replies!.map((child) => (
                  <CommentItem
                    key={child.id}
                    comment={child}
                    childrenMap={childrenMap}
                    depth={nextDepth}
                    locale={locale}
                    isAuthenticated={isAuthenticated}
                    onReply={onReply}
                    replyingTo={replyingTo}
                    replyBody={replyBody}
                    onReplyBodyChange={onReplyBodyChange}
                    onSubmitReply={onSubmitReply}
                    submitting={submitting}
                    dictionary={dictionary}
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

export default function ProjectComments({
  projectId,
  isAuthenticated,
}: ProjectCommentsProps) {
  const dictionary = useDictionary();
  const router = useLocalizedRouter();
  const locale = router.locale;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const result = await apiFetch<{ comments?: Comment[] }>(
        `/api/projects/${projectId}/comments`,
      );

      if (!result.ok) {
        setError(dictionary.projectComments.loadError);
      } else {
        setComments(result.data.comments || []);
      }
      setLoading(false);
    }

    void load();
  }, [projectId, dictionary.projectComments.loadError]);

  const submitComment = async (parentId: string | null = null) => {
    const text = parentId ? replyBody : body;

    if (!text.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const submitResult = await apiFetch(
      `/api/projects/${projectId}/comments`,
      {
        method: "POST",
        body: { body: text, parent_id: parentId },
      },
    );

    if (!submitResult.ok) {
      setError(submitResult.error || dictionary.projectComments.submitError);
      setSubmitting(false);
      return;
    }

    if (parentId) {
      setReplyBody("");
      setReplyingTo(null);
    } else {
      setBody("");
    }

    const refreshResult = await apiFetch<{ comments?: Comment[] }>(
      `/api/projects/${projectId}/comments`,
    );
    if (refreshResult.ok) {
      setComments(refreshResult.data.comments || []);
    }

    setSubmitting(false);

    startTransition(() => {
      router.refresh();
    });
  };

  const { topLevel, childrenMap } = buildCommentTree(comments);

  return (
    <section className="rounded-hero app-card p-5 sm:p-6">
      <h2 className="font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
        {dictionary.projectComments.title}
        {comments.length > 0 && (
          <span className="ml-2 text-base font-normal app-muted">
            ({comments.length})
          </span>
        )}
      </h2>

      {isAuthenticated ? (
        <div className="mt-5 space-y-3 sm:mt-6">
          <MentionTextarea
            value={body}
            onChange={setBody}
            placeholder={dictionary.projectComments.placeholder}
            rows={3}
            maxLength={4000}
            className="w-full resize-none rounded-xl border app-border bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />
          <Button
            onClick={() => submitComment(null)}
            disabled={submitting || !body.trim()}
          >
            {submitting
              ? dictionary.projectComments.sending
              : dictionary.projectComments.send}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm app-muted">
          {dictionary.projectComments.signInToComment}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-rose-500" role="alert">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm app-muted">
          {dictionary.projectComments.loading}
        </p>
      ) : comments.length === 0 ? (
        <p className="mt-6 text-sm app-muted">
          {dictionary.projectComments.noComments}
        </p>
      ) : (
        <div className="mt-6 space-y-4 sm:space-y-6">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              childrenMap={childrenMap}
              depth={0}
              locale={locale}
              isAuthenticated={isAuthenticated}
              onReply={setReplyingTo}
              replyingTo={replyingTo}
              replyBody={replyBody}
              onReplyBodyChange={setReplyBody}
              onSubmitReply={() => submitComment(replyingTo)}
              submitting={submitting}
              dictionary={dictionary}
            />
          ))}
        </div>
      )}
    </section>
  );
}
