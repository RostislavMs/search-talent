// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PollQuestion } from "@/lib/polls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import PollVoting from "@/components/poll-voting";
import { apiFetch } from "@/lib/api-client";

const POLL_ID = "22222222-2222-4222-8222-222222222222";

function q(partial: Record<string, unknown>): PollQuestion {
  return {
    options: [],
    selectedOptionIds: [],
    selectedRating: null,
    responsesCount: 0,
    ratingMin: null,
    ratingMax: null,
    ratingAverage: null,
    ...partial,
  } as unknown as PollQuestion;
}

const choiceOptions = [
  { id: "o1", label: "Option A", votesCount: 0, selected: false },
  { id: "o2", label: "Option B", votesCount: 0, selected: false },
];

function renderVoting(questions: PollQuestion[]) {
  return render(
    <PollVoting
      locale="en"
      pollId={POLL_ID}
      questions={questions}
      hasVoted={false}
      isClosed={false}
      resultsVisible={false}
      isAuthenticated
    />,
  );
}

function lastAnswers() {
  const call = vi.mocked(apiFetch).mock.calls.at(-1);
  return (call?.[1] as { body: { answers: unknown[] } }).body.answers;
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockResolvedValue({ ok: true, data: {} } as never);
});
afterEach(() => cleanup());

describe("<PollVoting />", () => {
  it("submits a single-choice answer", async () => {
    renderVoting([q({ id: "q1", type: "single", prompt: "Pick one", options: choiceOptions })]);
    await userEvent.click(screen.getByRole("radio", { name: "Option A" }));
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(lastAnswers()).toEqual([
      { question_id: "q1", option_ids: ["o1"], rating_value: null },
    ]);
  });

  it("replaces the choice for a single-select question", async () => {
    renderVoting([q({ id: "q1", type: "single", prompt: "Pick one", options: choiceOptions })]);
    await userEvent.click(screen.getByRole("radio", { name: "Option A" }));
    await userEvent.click(screen.getByRole("radio", { name: "Option B" }));
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(lastAnswers()).toEqual([
      { question_id: "q1", option_ids: ["o2"], rating_value: null },
    ]);
  });

  it("accumulates choices for a multiple-select question", async () => {
    renderVoting([q({ id: "q1", type: "multiple", prompt: "Pick some", options: choiceOptions })]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Option A" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Option B" }));
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(lastAnswers()).toEqual([
      { question_id: "q1", option_ids: ["o1", "o2"], rating_value: null },
    ]);
  });

  it("blocks submission with a friendly error when nothing is selected", async () => {
    renderVoting([q({ id: "q1", type: "multiple", prompt: "Pick some", options: choiceOptions })]);
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(screen.getByText(/pick an option/i)).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });

  it("submits a rating answer", async () => {
    renderVoting([q({ id: "q1", type: "rating", prompt: "Rate it", ratingMin: 1, ratingMax: 5 })]);
    await userEvent.click(screen.getByRole("button", { name: "4" }));
    await userEvent.click(screen.getByRole("button", { name: "Vote" }));
    expect(lastAnswers()).toEqual([
      { question_id: "q1", option_ids: [], rating_value: 4 },
    ]);
  });
});
