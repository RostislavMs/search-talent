"use client";

import { startTransition, useState } from "react";
import ContentReportButton from "@/components/content-report-button";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { getModerationCopy } from "@/lib/moderation-copy";

type VoteValue = 1 | -1 | null;

type ProfileVoteButtonsProps = {
  profileId: string;
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

export default function ProfileVoteButtons({
  profileId,
  initialVote,
  initialLikes,
  initialDislikes,
  isAuthenticated,
  isOwner,
}: ProfileVoteButtonsProps) {
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
    if (isOwner) {
      setErrorMessage(dictionary.creatorProfile.cannotRateOwnProfile);
      return;
    }

    if (!isAuthenticated) {
      setErrorMessage(dictionary.creatorProfile.signInToRate);
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
    }>("/api/profile-vote", {
      method: "POST",
      body: { profileId, value },
    });

    setLoading(false);

    if (!result.ok) {
      setVoteState(previousState);
      setErrorMessage(
        result.status === 403
          ? dictionary.creatorProfile.ratingEmailUnverified
          : result.error || dictionary.creatorProfile.ratingError,
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
    <section className="mt-8 rounded-[1.75rem] app-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            {dictionary.creatorProfile.profileRating}
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

      {isOwner ? (
        <p className="mt-3 text-sm app-muted">
          {dictionary.creatorProfile.ownerRatingHint}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => vote(1)}
              disabled={loading}
              variant={voteState.currentVote === 1 ? "primary" : "secondary"}
              aria-pressed={voteState.currentVote === 1}
            >
              {dictionary.creatorProfile.rateProfileUp} ({voteState.likes})
            </Button>

            <Button
              onClick={() => vote(-1)}
              disabled={loading}
              variant={voteState.currentVote === -1 ? "primary" : "ghost"}
              aria-pressed={voteState.currentVote === -1}
            >
              {dictionary.creatorProfile.rateProfileDown} ({voteState.dislikes})
            </Button>

            <ContentReportButton
              copy={moderationCopy}
              targetType="profile"
              targetId={profileId}
              isAuthenticated={isAuthenticated}
            />
          </div>

          <p className="mt-3 text-sm app-muted">
            {voteState.currentVote === 1
              ? dictionary.creatorProfile.ratingStateLiked
              : voteState.currentVote === -1
                ? dictionary.creatorProfile.ratingStateDisliked
                : dictionary.creatorProfile.ratingStateIdle}
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
