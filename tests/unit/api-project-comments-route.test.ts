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
vi.mock("@/lib/db/comment-events", () => ({ dispatchCommentSideEffects: vi.fn() }));
vi.mock("@/lib/db/comment-moderation", () => ({ deleteCommentAuthorized: vi.fn() }));
vi.mock("@/lib/db/reactions", () => ({ getReactionsForTargets: vi.fn(async () => ({})) }));
vi.mock("@/lib/gif/provider", () => ({ isAllowedGifUrl: vi.fn(() => true) }));
vi.mock("@/lib/auto-moderation", () => ({
  screenContentForModeration: vi.fn(() => ({ flagged: false, note: "" })),
  describeModerationResult: () => "blocked",
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));

import { POST } from "@/app/api/projects/[id]/comments/route";
import { DELETE } from "@/app/api/projects/[id]/comments/[commentId]/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { dispatchCommentSideEffects } from "@/lib/db/comment-events";
import { deleteCommentAuthorized } from "@/lib/db/comment-moderation";
import { isAllowedGifUrl } from "@/lib/gif/provider";
import { screenContentForModeration } from "@/lib/auto-moderation";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const COMMENT_ID = "33333333-3333-4333-8333-333333333333";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
const publicProject = { id: PROJECT_ID, owner_id: "owner-x", moderation_status: "approved" };
function publicResolver(table: string, verb: string): QueryResult {
  if (table === "projects") return { data: publicProject };
  if (table === "project_comments" && verb === "select") return { data: null };
  if (table === "project_comments" && verb === "insert") return { data: { id: "c-new" } };
  return {};
}
const params = () => ({ params: Promise.resolve({ id: PROJECT_ID }) });
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

describe("POST /api/projects/[id]/comments", () => {
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
    const res = await POST(postReq({ body: "spam" }), params());
    expect((await res.json()).code).toBe("moderation_blocked");
  });

  it("404 when the project is not public", async () => {
    setMock(authUser, (table) =>
      table === "projects" ? { data: { ...publicProject, moderation_status: "removed" } } : {},
    );
    expect((await POST(postReq({ body: "hi" }), params())).status).toBe(404);
  });

  it("creates the comment and dispatches side effects", async () => {
    const mock = setMock(authUser, publicResolver);
    const res = await POST(postReq({ body: "nice work" }), params());
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "project_comments" && c.verb === "insert")).toBe(true);
    expect(vi.mocked(dispatchCommentSideEffects)).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/projects/[id]/comments/[commentId]", () => {
  const delParams = () => ({ params: Promise.resolve({ id: PROJECT_ID, commentId: COMMENT_ID }) });
  function viewer(user: MockUser, isAdmin: boolean) {
    const mock = createSupabaseMock({ user, resolve: () => ({}) });
    holder.mock = mock;
    vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  }

  it("401 when unauthenticated", async () => {
    viewer(null, false);
    expect((await DELETE(new Request("http://x", { method: "DELETE" }), delParams())).status).toBe(401);
  });

  it("propagates a 403 from the authorization helper", async () => {
    viewer(authUser, false);
    vi.mocked(deleteCommentAuthorized).mockResolvedValue({ ok: false, error: "Forbidden", status: 403 } as never);
    expect((await DELETE(new Request("http://x", { method: "DELETE" }), delParams())).status).toBe(403);
  });

  it("deletes with kind=project when authorized", async () => {
    viewer(authUser, true);
    vi.mocked(deleteCommentAuthorized).mockResolvedValue({ ok: true } as never);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), delParams());
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteCommentAuthorized)).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "project", commentId: COMMENT_ID }),
    );
  });
});
