import { describe, expect, it } from "vitest";
import { getOptimisticVoteState, type VoteState } from "@/lib/vote-state";

const base: VoteState = { likes: 10, dislikes: 4, currentVote: null };

describe("getOptimisticVoteState", () => {
  it("adds a like when there was no prior vote", () => {
    expect(getOptimisticVoteState(base, 1)).toEqual({
      likes: 11,
      dislikes: 4,
      currentVote: 1,
    });
  });

  it("adds a dislike when there was no prior vote", () => {
    expect(getOptimisticVoteState(base, -1)).toEqual({
      likes: 10,
      dislikes: 5,
      currentVote: -1,
    });
  });

  it("toggles off an existing like (clicking up again)", () => {
    const liked: VoteState = { likes: 11, dislikes: 4, currentVote: 1 };
    expect(getOptimisticVoteState(liked, 1)).toEqual({
      likes: 10,
      dislikes: 4,
      currentVote: null,
    });
  });

  it("toggles off an existing dislike (clicking down again)", () => {
    const disliked: VoteState = { likes: 10, dislikes: 5, currentVote: -1 };
    expect(getOptimisticVoteState(disliked, -1)).toEqual({
      likes: 10,
      dislikes: 4,
      currentVote: null,
    });
  });

  it("switches from like to dislike, moving the count across", () => {
    const liked: VoteState = { likes: 11, dislikes: 4, currentVote: 1 };
    expect(getOptimisticVoteState(liked, -1)).toEqual({
      likes: 10,
      dislikes: 5,
      currentVote: -1,
    });
  });

  it("switches from dislike to like, moving the count across", () => {
    const disliked: VoteState = { likes: 10, dislikes: 5, currentVote: -1 };
    expect(getOptimisticVoteState(disliked, 1)).toEqual({
      likes: 11,
      dislikes: 4,
      currentVote: 1,
    });
  });

  it("does not mutate the input state", () => {
    const input: VoteState = { likes: 1, dislikes: 1, currentVote: 1 };
    const snapshot = { ...input };
    getOptimisticVoteState(input, -1);
    expect(input).toEqual(snapshot);
  });
});
