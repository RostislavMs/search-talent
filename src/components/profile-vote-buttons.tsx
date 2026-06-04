"use client";

import { startTransition, useState } from "react";
import ContentReportButton from "@/components/content-report-button";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { getModerationCopy } from "@/lib/moderation-copy";

type VoteValue = 1 | -1 | null;

type ProfileVoteButtonsProps = {
  profileId: string;
  initialVote: VoteValue;
  initialLikes: number;
  initialDislikes: number;
  // Composite creator rating (0-100), same as the talents/leaderboard value.
  // Falls back to net votes in the badge when null (profile not ranked yet).
  rating?: number | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  className?: string;
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
  rating,
  isAuthenticated,
  isOwner,
  className,
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
    <section className={className ?? "mt-8 rounded-panel app-panel p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
              {dictionary.creatorProfile.profileRating}
            </h2>
            <LocalizedLink
              href="/rating-guide"
              className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--muted-foreground)] underline decoration-dotted underline-offset-4 transition hover:text-[color:var(--foreground)]"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm.85 9.6h-1.7v-1.7h1.7v1.7Zm.7-4.3c-.2.3-.6.6-1 .9-.3.2-.4.4-.5.6-.05.15-.1.4-.1.7H6.45c0-.6.05-1 .2-1.3.15-.3.45-.55.85-.85.25-.2.45-.35.55-.5a.85.85 0 0 0 .2-.55.7.7 0 0 0-.25-.55c-.15-.15-.35-.25-.6-.25a.95.95 0 0 0-.7.27.95.95 0 0 0-.3.72H4.65c0-.65.25-1.2.75-1.65a2.8 2.8 0 0 1 1.85-.7c.7 0 1.3.2 1.75.6.45.4.7.95.7 1.6 0 .35-.1.7-.3 1.05Z" />
              </svg>
              <span>{dictionary.creatorProfile.ratingHowItWorks}</span>
            </LocalizedLink>
          </div>
          <p className="mt-1 text-sm app-muted">
            {voteState.likes} {dictionary.projectPage.likes} / {voteState.dislikes}{" "}
            {dictionary.projectPage.dislikes}
          </p>
        </div>

        <span className="font-display rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-on-soft">
          {typeof rating === "number"
            ? rating
            : voteState.likes - voteState.dislikes}{" "}
          {dictionary.common.scoreSuffix}
        </span>
      </div>

      {isOwner ? (
        <p className="mt-3 text-sm app-muted">
          {dictionary.creatorProfile.ownerRatingHint}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
            <Button
              onClick={() => vote(1)}
              disabled={loading}
              variant={voteState.currentVote === 1 ? "primary" : "secondary"}
              aria-pressed={voteState.currentVote === 1}
              aria-label={`${dictionary.creatorProfile.rateProfileUp} (${voteState.likes})`}
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
                {dictionary.creatorProfile.rateProfileUp}{" "}
              </span>
              ({voteState.likes})
            </Button>

            <Button
              onClick={() => vote(-1)}
              disabled={loading}
              variant={voteState.currentVote === -1 ? "primary" : "ghost"}
              aria-pressed={voteState.currentVote === -1}
              aria-label={`${dictionary.creatorProfile.rateProfileDown} (${voteState.dislikes})`}
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
                {dictionary.creatorProfile.rateProfileDown}{" "}
              </span>
              ({voteState.dislikes})
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
