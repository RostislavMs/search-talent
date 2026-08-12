// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/i18n/client", () => ({
  useCurrentLocale: () => "en",
  useDictionary: () => ({
    projectComments: {
      title: "Comments",
      placeholder: "Write a comment...",
      replyPlaceholder: "Write a reply...",
      send: "Send",
      sending: "Sending...",
      cancel: "Cancel",
      reply: "Reply",
      signInToComment: "Sign in to leave a comment.",
      noComments: "No comments yet.",
      loading: "Loading comments...",
      loadError: "Could not load comments.",
      submitError: "Could not post your comment.",
      anonymous: "User",
      deletedUser: "Deleted user",
    },
    commentGif: { addGif: "Add GIF", removeGif: "Remove GIF" },
    discussions: {
      sectionTitle: "Discussion",
      openFull: "Open the full discussion",
      previewNote: "Showing {shown} of {total} comments.",
    },
  }),
  useLocalizedRouter: () => ({ locale: "en", refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/components/comment-delete-button", () => ({ default: () => null }));
vi.mock("@/components/ui/reaction-picker", () => ({ default: () => null }));
vi.mock("@/components/ui/gif-picker", () => ({ default: () => null }));
vi.mock("@/components/ui/comment-gif", () => ({ default: () => null }));
vi.mock("@/components/ui/mention-text", () => ({
  default: ({ body }: { body: string }) => <p>{body}</p>,
}));
vi.mock("@/components/ui/mention-textarea", () => ({
  default: () => <textarea aria-label="composer" readOnly />,
}));

import ProjectComments from "@/components/project-comments";
import { apiFetch } from "@/lib/api-client";
import {
  DISCUSSION_COMMENT_THRESHOLD,
  DISCUSSION_PREVIEW_LIMIT,
} from "@/lib/discussions";

const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const DISCUSSION_HREF = "/projects/demo/discussion";

type TestComment = {
  id: string;
  project_id: string;
  author_user_id: string | null;
  parent_id: string | null;
  body: string;
  media_url: string | null;
  created_at: string;
  author: { username: string; name: string; avatar_url: string | null };
};

function comment(id: string, parentId: string | null = null): TestComment {
  return {
    id,
    project_id: PROJECT_ID,
    author_user_id: `user-${id}`,
    parent_id: parentId,
    body: `body-${id}`,
    media_url: null,
    created_at: "2026-08-01T10:00:00.000Z",
    author: { username: `u${id}`, name: `Name ${id}`, avatar_url: null },
  };
}

function renderComments(
  comments: TestComment[],
  previewLimit: number | null,
  discussionHref: string | null = DISCUSSION_HREF,
) {
  vi.mocked(apiFetch).mockResolvedValue({
    ok: true,
    data: { comments },
  } as unknown as Awaited<ReturnType<typeof apiFetch>>);

  return render(
    <ProjectComments
      projectId={PROJECT_ID}
      isAuthenticated={false}
      viewerUserId={null}
      ownerUserId="owner"
      gifEnabled={false}
      previewLimit={previewLimit}
      discussionHref={discussionHref}
    />,
  );
}

describe("ProjectComments discussion preview", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  afterEach(cleanup);

  it("shows the whole thread and no permalink below the threshold", async () => {
    const comments = Array.from({ length: DISCUSSION_COMMENT_THRESHOLD - 1 }, (_, i) =>
      comment(`c${i}`),
    );
    renderComments(comments, DISCUSSION_PREVIEW_LIMIT);

    expect(await screen.findByText("body-c0")).toBeInTheDocument();
    expect(
      screen.getByText(`body-c${comments.length - 1}`),
    ).toBeInTheDocument();
    expect(screen.queryByText("Open the full discussion")).toBeNull();
  });

  it("caps top-level comments and links out once promoted", async () => {
    const comments = Array.from({ length: 8 }, (_, i) => comment(`c${i}`));
    renderComments(comments, DISCUSSION_PREVIEW_LIMIT);

    expect(await screen.findByText("body-c0")).toBeInTheDocument();
    expect(
      screen.getByText(`body-c${DISCUSSION_PREVIEW_LIMIT - 1}`),
    ).toBeInTheDocument();
    // Everything past the cap lives on the discussion page only.
    expect(screen.queryByText(`body-c${DISCUSSION_PREVIEW_LIMIT}`)).toBeNull();

    const link = screen.getByRole("link", {
      name: "Open the full discussion",
    });
    expect(link).toHaveAttribute("href", `/en${DISCUSSION_HREF}`);
    expect(
      screen.getByText(
        `Showing ${DISCUSSION_PREVIEW_LIMIT} of ${comments.length} comments.`,
      ),
    ).toBeInTheDocument();
  });

  it("counts replies toward the total but never splits them from their parent", async () => {
    // Two top-level comments carrying eight replies: promoted, yet nothing is
    // actually hidden, so the permalink shows without a misleading count.
    const comments = [
      comment("a"),
      comment("b"),
      ...Array.from({ length: 4 }, (_, i) => comment(`a${i}`, "a")),
      ...Array.from({ length: 4 }, (_, i) => comment(`b${i}`, "b")),
    ];
    renderComments(comments, DISCUSSION_PREVIEW_LIMIT);

    expect(await screen.findByText("body-a")).toBeInTheDocument();
    expect(screen.getByText("body-b")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the full discussion" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Showing \d+ of \d+ comments/)).toBeNull();
  });

  it("shows everything and never self-links on the discussion page", async () => {
    // The discussion page renders the same component with neither prop set.
    const comments = Array.from({ length: 8 }, (_, i) => comment(`c${i}`));
    renderComments(comments, null, null);

    expect(await screen.findByText("body-c0")).toBeInTheDocument();
    expect(screen.getByText("body-c7")).toBeInTheDocument();
    expect(screen.queryByText("Open the full discussion")).toBeNull();
  });
});
