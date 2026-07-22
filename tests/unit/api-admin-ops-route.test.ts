import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));

import { DELETE as commentDelete } from "@/app/api/admin/comments/[id]/route";
import { POST as commentBulk } from "@/app/api/admin/comments/bulk/route";
import { POST as refreshScores } from "@/app/api/admin/refresh-scores/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const ID2 = "33333333-3333-4333-8333-333333333333";
const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(user: MockUser, isAdmin: boolean, resolve: (t: string, v: string) => QueryResult, rpc?: () => QueryResult): SupabaseMock {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb), rpc });
  vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  return mock;
}

afterEach(() => vi.clearAllMocks());

describe("admin/comments/[id] DELETE", () => {
  const params = () => ({ params: Promise.resolve({ id: ID }) });
  const req = (kind: string) => new Request(`http://x?kind=${kind}`, { method: "DELETE" });

  it("401/403 gate", async () => {
    viewer(null, false, () => ({}));
    expect((await commentDelete(req("article"), params())).status).toBe(401);
    viewer(adminUser, false, () => ({}));
    expect((await commentDelete(req("article"), params())).status).toBe(403);
  });

  it("400 for an invalid kind", async () => {
    viewer(adminUser, true, () => ({ error: null }));
    expect((await commentDelete(req("bogus"), params())).status).toBe(400);
  });

  it("deletes from article_comments for kind=article", async () => {
    const mock = viewer(adminUser, true, () => ({ error: null }));
    expect((await commentDelete(req("article"), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "article_comments" && c.verb === "delete")).toBe(true);
  });

  it("deletes from project_comments for kind=project", async () => {
    const mock = viewer(adminUser, true, () => ({ error: null }));
    expect((await commentDelete(req("project"), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "project_comments" && c.verb === "delete")).toBe(true);
  });
});

describe("admin/comments/bulk POST", () => {
  const req = (body: unknown, raw = false) =>
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: raw ? (body as string) : JSON.stringify(body) });

  it("403 for non-admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await commentBulk(req({ items: [{ id: ID, kind: "article" }] }))).status).toBe(403);
  });

  it("400 on invalid JSON", async () => {
    viewer(adminUser, true, () => ({ error: null }));
    expect((await commentBulk(req("{bad", true))).status).toBe(400);
  });

  it("bulk-deletes mixed article/project comments", async () => {
    const mock = viewer(adminUser, true, () => ({ error: null }));
    const res = await commentBulk(req({ items: [{ id: ID, kind: "article" }, { id: ID2, kind: "project" }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(2);
    expect(mock.calls.some((c) => c.table === "article_comments" && c.verb === "delete")).toBe(true);
    expect(mock.calls.some((c) => c.table === "project_comments" && c.verb === "delete")).toBe(true);
  });
});

describe("admin/refresh-scores POST", () => {
  it("401/403 gate", async () => {
    viewer(null, false, () => ({}));
    expect((await refreshScores()).status).toBe(401);
    viewer(adminUser, false, () => ({}));
    expect((await refreshScores()).status).toBe(403);
  });

  it("runs recompute_all_scores", async () => {
    const rpc = vi.fn(() => ({ error: null }));
    viewer(adminUser, true, () => ({}), rpc);
    expect((await refreshScores()).status).toBe(200);
    expect(rpc).toHaveBeenCalled();
  });

  it("maps an RPC error to 400", async () => {
    viewer(adminUser, true, () => ({}), () => ({ error: { message: "recompute failed" } }));
    expect((await refreshScores()).status).toBe(400);
  });
});
