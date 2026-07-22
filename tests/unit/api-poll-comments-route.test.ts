import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn() }));
vi.mock("@/lib/db/comment-moderation", () => ({ deleteCommentAuthorized: vi.fn() }));
vi.mock("@/lib/gif/provider", () => ({ isAllowedGifUrl: vi.fn(() => true) }));
vi.mock("@/lib/auto-moderation", () => ({
  screenContentForModeration: vi.fn(() => ({ flagged: false, note: "" })),
  describeModerationResult: () => "blocked",
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));

import { POST } from "@/app/api/polls/[id]/comments/route";
import { DELETE } from "@/app/api/polls/[id]/comments/[commentId]/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { deleteCommentAuthorized } from "@/lib/db/comment-moderation";
import { isAllowedGifUrl } from "@/lib/gif/provider";
import { screenContentForModeration } from "@/lib/auto-moderation";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POLL_ID = "22222222-2222-4222-8222-222222222222";
const COMMENT_ID = "33333333-3333-4333-8333-333333333333";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
const publishedPoll = { id: POLL_ID, slug: "s", author_user_id: "author-x", status: "published", moderation_status: "approved" };
function publicResolver(table: string, verb: string): QueryResult {
  if (table === "polls") return { data: publishedPoll };
  if (table === "poll_comments" && verb === "select") return { data: null };
  if (table === "poll_comments" && verb === "insert") return { data: { id: "c-new" } };
  return {};
}
const params = () => ({ params: Promise.resolve({ id: POLL_ID }) });
function postReq(body: unknown) {
  return new Request("http://test/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
  vi.mocked(isAllowedGifUrl).mockReturnValue(true);
  vi.mocked(screenContentForModeration).mockReturnValue({ flagged: false, note: "" } as never);
});

describe("POST /api/polls/[id]/comments", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(postReq({ body: "hi" }), params())).status).toBe(401);
  });

  it("400 on a disallowed GIF URL", async () => {
    setMock(authUser, publicResolver);
    vi.mocked(isAllowedGifUrl).mockReturnValue(false);
    expect((await POST(postReq({ body: "", media_url: "https://evil/x.gif" }), params())).status).toBe(400);
  });

  it("400 (moderation_blocked) when flagged", async () => {
    setMock(authUser, publicResolver);
    vi.mocked(screenContentForModeration).mockReturnValue({ flagged: true, note: "bad" } as never);
    expect((await POST(postReq({ body: "spam" }), params())).status).toBe(400);
  });

  it("404 when the poll is not published/public", async () => {
    setMock(authUser, (table) =>
      table === "polls" ? { data: { ...publishedPoll, status: "draft" } } : {},
    );
    expect((await POST(postReq({ body: "hi" }), params())).status).toBe(404);
  });

  it("creates the comment", async () => {
    const mock = setMock(authUser, publicResolver);
    const res = await POST(postReq({ body: "interesting poll" }), params());
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "poll_comments" && c.verb === "insert")).toBe(true);
  });
});

describe("DELETE /api/polls/[id]/comments/[commentId]", () => {
  const delParams = () => ({ params: Promise.resolve({ id: POLL_ID, commentId: COMMENT_ID }) });
  function viewer(user: MockUser, isAdmin: boolean) {
    const mock = createSupabaseMock({ user, resolve: () => ({}) });
    holder.mock = mock;
    vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  }

  it("401 when unauthenticated", async () => {
    viewer(null, false);
    expect((await DELETE(new Request("http://x", { method: "DELETE" }), delParams())).status).toBe(401);
  });

  it("deletes with kind=poll when authorized", async () => {
    viewer(authUser, false);
    vi.mocked(deleteCommentAuthorized).mockResolvedValue({ ok: true } as never);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), delParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteCommentAuthorized)).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "poll", commentId: COMMENT_ID }),
    );
  });
});
