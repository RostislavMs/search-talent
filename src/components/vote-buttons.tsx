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
    <section className="rounded-[1.75rem] app-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            {dictionary.projectPage.community}
          </h2>
          <p className="mt-1 text-sm app-muted">
            {voteState.likes} {dictionary.projectPage.likes} / {voteState.dislikes}{" "}
            {dictionary.projectPage.dislikes}
          </p>
        </div>

        <span className="rounded-full border app-border px-3 py-1 text-xs font-medium app-muted">
          {voteState.likes - voteState.dislikes} {dictionary.common.scoreSuffix}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          onClick={() => vote(1)}
          disabled={loading}
          variant={voteState.currentVote === 1 ? "primary" : "secondary"}
          aria-pressed={voteState.currentVote === 1}
        >
          {dictionary.projectPage.likeProject} ({voteState.likes})
        </Button>

        <Button
          onClick={() => vote(-1)}
          disabled={loading}
          variant={voteState.currentVote === -1 ? "primary" : "ghost"}
          aria-pressed={voteState.currentVote === -1}
        >
          {dictionary.projectPage.dislikeProject} ({voteState.dislikes})
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

      {errorMessage && <p className="mt-3 text-sm text-rose-500">{errorMessage}</p>}
    </section>
  );
}
