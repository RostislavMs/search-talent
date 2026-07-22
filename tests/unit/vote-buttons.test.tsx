// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/i18n/client", () => ({
  useCurrentLocale: () => "en",
  useDictionary: () => ({
    projectPage: {
      community: "Community",
      likeProject: "Like",
      dislikeProject: "Dislike",
      views: "Views",
      ownerVoteHint: "Owners cannot vote",
      signInToVote: "Sign in to vote",
      voteEmailUnverified: "Verify your email",
      voteError: "Something went wrong",
    },
  }),
  useLocalizedRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/moderation-copy", () => ({ getModerationCopy: () => ({}) }));
vi.mock("@/components/content-report-button", () => ({ default: () => null }));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import VoteButtons from "@/components/vote-buttons";
import { apiFetch } from "@/lib/api-client";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function renderButtons(overrides: Partial<Parameters<typeof VoteButtons>[0]> = {}) {
  // Pre-set the view flag so the mount effect does not POST a view.
  window.localStorage.setItem(`project-viewed:${PROJECT_ID}`, "1");
  return render(
    <VoteButtons
      projectId={PROJECT_ID}
      initialVote={null}
      initialLikes={10}
      initialDislikes={4}
      initialViews={99}
      isAuthenticated
      isOwner={false}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(apiFetch).mockReset();
});
afterEach(() => cleanup());

describe("<VoteButtons />", () => {
  it("optimistically increments the like count and reconciles with the server", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      data: { likes: 11, dislikes: 4, currentVote: 1 },
    } as never);

    renderButtons();
    await userEvent.click(screen.getByRole("button", { name: /^Like/ }));

    expect(await screen.findByRole("button", { name: /Like \(11\)/ })).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      "/api/vote",
      expect.objectContaining({ method: "POST", body: { projectId: PROJECT_ID, value: 1 } }),
    );
  });

  it("rolls back and shows the email-unverified error on a 403", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: false, status: 403, error: "nope" } as never);

    renderButtons();
    await userEvent.click(screen.getByRole("button", { name: /^Like/ }));

    // Count reverts to the original 10 and the specific 403 message appears.
    expect(await screen.findByRole("button", { name: /Like \(10\)/ })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Verify your email");
  });

  it("does not call the API when the user is unauthenticated", async () => {
    renderButtons({ isAuthenticated: false });
    await userEvent.click(screen.getByRole("button", { name: /^Like/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Sign in to vote");
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
  });
});
