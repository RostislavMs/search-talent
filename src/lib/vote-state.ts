/**
 * Shared optimistic vote-state reducer for the project and profile vote
 * buttons. Extracted so both components (which had byte-identical copies) stay
 * in sync and the logic is unit-testable without rendering.
 */

export type VoteValue = 1 | -1 | null;

export type VoteState = {
  likes: number;
  dislikes: number;
  currentVote: VoteValue;
};

/**
 * Applies a click on the up (1) or down (-1) button to the current tally:
 * removes the previous vote's contribution, then either toggles the same vote
 * off (currentVote → null) or switches to the new one.
 */
export function getOptimisticVoteState(state: VoteState, nextValue: 1 | -1): VoteState {
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
