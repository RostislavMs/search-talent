import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/rate-limit", () => ({
  dbRateLimit: vi.fn(async () => null),
  rateLimit: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/db/comment-events", () => ({ dispatchCommentSideEffects: vi.fn() }));
vi.mock("@/lib/db/comment-moderation", () => ({ deleteCommentAuthorized: vi.fn() }));
vi.mock("@/lib/gif/provider", () => ({ isAllowedGifUrl: vi.fn(() => true) }));
vi.mock("@/lib/auto-moderation", () => ({
  screenContentForModeration: vi.fn(() => ({ flagged: false, note: "" })),
  describeModerationResult: () => "blocked reason",
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));

import { POST } from "@/app/api/articles/[id]/comments/route";
import { DELETE } from "@/app/api/articles/[id]/comments/[commentId]/route";
import { NextResponse } from "next/server";
import { dbRateLimit } from "@/lib/rate-limit";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { dispatchCommentSideEffects } from "@/lib/db/comment-events";
import { deleteCommentAuthorized } from "@/lib/db/comment-moderation";
import { isAllowedGifUrl } from "@/lib/gif/provider";
import { screenContentForModeration } from "@/lib/auto-moderation";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ARTICLE_ID = "22222222-2222-4222-8222-222222222222";
const COMMENT_ID = "33333333-3333-4333-8333-333333333333";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

const publishedArticle = {
  id: ARTICLE_ID,
  slug: "a-slug",
  author_user_id: "author-x",
  status: "published",
  moderation_status: "approved",
};

function publishedResolver(table: string, verb: string): QueryResult {
  if (table === "articles") return { data: publishedArticle };
  if (table === "article_comments" && verb === "select") return { data: null }; // parent lookup
  if (table === "article_comments" && verb === "insert") return { data: { id: "c-new" } };
  return {};
}

const params = () => ({ params: Promise.resolve({ id: ARTICLE_ID }) });
function postReq(body: unknown): Request {
  return new Request(`http://test/api/articles/${ARTICLE_ID}/comments`, {
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

describe("POST /api/articles/[id]/comments — rate limiting", () => {
  it("429 when the comment rate limit trips", async () => {
    setMock(authUser, publishedResolver);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "Too many" }, { status: 429 }),
    );
    expect((await POST(postReq({ body: "hi" }), params())).status).toBe(429);
  });
});

describe("POST /api/articles/[id]/comments", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(postReq({ body: "hi" }), params())).status).toBe(401);
  });

  it("400 on an empty comment (no body, no media)", async () => {
    setMock(authUser, publishedResolver);
    expect((await POST(postReq({ body: "" }), params())).status).toBe(400);
  });

  it("400 on a disallowed GIF URL", async () => {
    setMock(authUser, publishedResolver);
    vi.mocked(isAllowedGifUrl).mockReturnValue(false);
    const res = await POST(postReq({ body: "", media_url: "https://evil.example/x.gif" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid gif/i);
  });

  it("400 (moderation_blocked) when the body is flagged", async () => {
    setMock(authUser, publishedResolver);
    vi.mocked(screenContentForModeration).mockReturnValue({ flagged: true, note: "bad" } as never);
    const res = await POST(postReq({ body: "spammy text" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("moderation_blocked");
  });

  it("404 when the article is not published/public", async () => {
    setMock(authUser, (table) =>
      table === "articles" ? { data: { ...publishedArticle, status: "draft" } } : {},
    );
    expect((await POST(postReq({ body: "hi" }), params())).status).toBe(404);
  });

  it("creates the comment and dispatches side effects", async () => {
    const mock = setMock(authUser, publishedResolver);
    const res = await POST(postReq({ body: "great article" }), params());
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "article_comments" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({ article_id: ARTICLE_ID, author_user_id: USER_ID });
    expect(vi.mocked(dispatchCommentSideEffects)).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/articles/[id]/comments/[commentId]", () => {
  const delParams = () => ({ params: Promise.resolve({ id: ARTICLE_ID, commentId: COMMENT_ID }) });
  const delReq = () => new Request("http://test/x", { method: "DELETE" });

  function viewer(user: MockUser, isAdmin: boolean) {
    const mock = createSupabaseMock({ user, resolve: () => ({}) });
    holder.mock = mock;
    vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  }

  it("401 when unauthenticated", async () => {
    viewer(null, false);
    expect((await DELETE(delReq(), delParams())).status).toBe(401);
  });

  it("propagates the authorization result (403 not owner/admin)", async () => {
    viewer(authUser, false);
    vi.mocked(deleteCommentAuthorized).mockResolvedValue({ ok: false, error: "Forbidden", status: 403 } as never);
    expect((await DELETE(delReq(), delParams())).status).toBe(403);
  });

  it("deletes when authorized", async () => {
    viewer(authUser, false);
    vi.mocked(deleteCommentAuthorized).mockResolvedValue({ ok: true } as never);
    const res = await DELETE(delReq(), delParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteCommentAuthorized)).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "article", commentId: COMMENT_ID, userId: USER_ID }),
    );
  });
});
