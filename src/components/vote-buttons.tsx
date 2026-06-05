"use client";

import { startTransition, useState } from "react";
import ContentReportButton from "@/components/content-report-button";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { getModerationCopy } from "@/lib/moderation-copy";

type VoteValue = 1 | -1 | null;

type VoteButtonsProps = {
  projectId: string;
  initialVote: VoteValue;
  initialLikes: number;
  initialDislikes: number;
  isAuthenticated: boolean;
  isOwner: boolean;
};

type VoteState = {
  likes: number;
  dislikes: number;
  currentVote: VoteValue;
};

function getOptimisticVoteState(state: VoteState, nextValue: 1 | -1): VoteState {
  let likes = state.likes;
  let dislikes = state.dislikes;

  if (state.currentVote === 1) {
    likes -= 1;
  }

  if (state.currentVote === -1) {
    dislikes -= 1;
  }

  const currentVote = state.currentVote === nextValue ? null : nextValue;

  if (currentVote === 1) {
    likes += 1;
  }

  if (currentVote === -1) {
    dislikes += 1;
  }

  return {
    likes,
    dislikes,
    currentVote,
  };
}

export default function VoteButtons({
  projectId,
  initialVote,
  initialLikes,
  initialDislikes,
  isAuthenticated,
  isOwner,
}: VoteButtonsProps) {
  const locale = useCurrentLocale();
  const dictionary = useDictionary();
  const moderationCopy = getModerationCopy(locale);
  const router = useLocalizedRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voteState, setVoteState] = useState<VoteState>({
    likes: initialLikes,
    dislikes: initialDislikes,
    currentVote: initialVote,
  });

  const vote = async (value: 1 | -1) => {
    if (!isAuthenticated) {
      setErrorMessage(dictionary.projectPage.signInToVote);
      return;
    }

    const previousState = voteState;
    const optimisticState = getOptimisticVoteState(voteState, value);

    setLoading(true);
    setErrorMessage(null);
    setVoteState(optimisticState);

    const result = await apiFetch<{
      likes?: number;
      dislikes?: number;
      currentVote?: VoteValue;
    }>("/api/vote", {
      method: "POST",
      body: { projectId, value },
    });

    setLoading(false);

    if (!result.ok) {
      setVoteState(previousState);
      setErrorMessage(
        result.status === 403
          ? dictionary.projectPage.voteEmailUnverified
          : result.error || dictionary.projectPage.voteError,
      );
      return;
    }

    setVoteState({
      likes: result.data.likes ?? optimisticState.likes,
      dislikes: result.data.dislikes ?? optimisticState.dislikes,
      currentVote:
        result.data.currentVote === 1 || result.data.currentVote === -1
          ? result.data.currentVote
          : null,
    });

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <section className="rounded-panel app-panel p-5">
      <div>
        <h2 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dictionary.projectPage.community}
        </h2>
        <p className="mt-1 text-sm app-muted">
          {voteState.likes} {dictionary.projectPage.likes} / {voteState.dislikes}{" "}
          {dictionary.projectPage.dislikes}
        </p>
      </div>

      {isOwner ? (
        <p className="mt-3 text-sm app-muted">
          {dictionary.projectPage.ownerVoteHint}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            <Button
              onClick={() => vote(1)}
              disabled={loading}
              variant={voteState.currentVote === 1 ? "primary" : "secondary"}
              aria-pressed={voteState.currentVote === 1}
              aria-label={`${dictionary.projectPage.likeProject} (${voteState.likes})`}
              className="gap-1.5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M2 21h2.5a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H2v10Zm5.5-10.5 4.2-7a1.4 1.4 0 0 1 2.6.7V8h5.1a1.7 1.7 0 0 1 1.7 2l-1.3 8.2a2 2 0 0 1-2 1.7H7.5V10.5Z" />
              </svg>
              <span className="hidden sm:inline">
                {dictionary.projectPage.likeProject}{" "}
              </span>
              ({voteState.likes})
            </Button>

            <Button
              onClick={() => vote(-1)}
              disabled={loading}
              variant={voteState.currentVote === -1 ? "primary" : "ghost"}
              aria-pressed={voteState.currentVote === -1}
              aria-label={`${dictionary.projectPage.dislikeProject} (${voteState.dislikes})`}
              className="gap-1.5"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M22 3h-2.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H22V3Zm-5.5 10.5-4.2 7a1.4 1.4 0 0 1-2.6-.7V16H4.6a1.7 1.7 0 0 1-1.7-2l1.3-8.2a2 2 0 0 1 2-1.7h10.3v9.4Z" />
              </svg>
              <span className="hidden sm:inline">
                {dictionary.projectPage.dislikeProject}{" "}
              </span>
              ({voteState.dislikes})
            </Button>

            <ContentReportButton
              copy={moderationCopy}
              targetType="project"
              targetId={projectId}
              isAuthenticated={isAuthenticated}
            />
          </div>

          <p className="mt-3 text-sm app-muted">
            {voteState.currentVote === 1
              ? dictionary.projectPage.voteStateLiked
              : voteState.currentVote === -1
                ? dictionary.projectPage.voteStateDisliked
                : dictionary.projectPage.voteStateIdle}
          </p>

          {errorMessage && (
            <p className="mt-3 text-sm text-rose-500" role="alert">
              {errorMessage}
            </p>
          )}
        </>
      )}
    </section>
  );
}
