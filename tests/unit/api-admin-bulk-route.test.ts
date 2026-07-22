import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));

import { POST } from "@/app/api/admin/bulk/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ID_A = "22222222-2222-4222-8222-222222222222";
const ID_B = "33333333-3333-4333-8333-333333333333";
const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(user: MockUser, isAdmin: boolean, resolve: (t: string, v: string) => QueryResult): SupabaseMock {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  return mock;
}

function req(body: unknown, raw = false): Request {
  return new Request("http://test/api/admin/bulk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

const statusRows: QueryResult = { data: [{ id: ID_A, moderation_status: "approved" }, { id: ID_B, moderation_status: "under_review" }] };

afterEach(() => vi.clearAllMocks());

describe("POST /api/admin/bulk — gate & validation", () => {
  it("401 when unauthenticated", async () => {
    viewer(null, false, () => ({}));
    expect((await POST(req({ targetType: "project", ids: [ID_A], action: "delete" }))).status).toBe(401);
  });

  it("403 when not an admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await POST(req({ targetType: "project", ids: [ID_A], action: "delete" }))).status).toBe(403);
  });

  it("400 on invalid JSON", async () => {
    viewer(adminUser, true, () => ({}));
    expect((await POST(req("{not-json", true))).status).toBe(400);
  });

  it("400 on an invalid payload (empty ids)", async () => {
    viewer(adminUser, true, () => ({}));
    expect((await POST(req({ targetType: "project", ids: [], action: "delete" }))).status).toBe(400);
  });
});

describe("POST /api/admin/bulk — actions", () => {
  it("blocks bulk profile deletion", async () => {
    viewer(adminUser, true, () => ({ error: null }));
    const res = await POST(req({ targetType: "profile", ids: [ID_A], action: "delete" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not supported/i);
  });

  it("bulk-deletes projects", async () => {
    const mock = viewer(adminUser, true, () => ({ error: null }));
    const res = await POST(req({ targetType: "project", ids: [ID_A, ID_B], action: "delete" }));
    expect(res.status).toBe(200);
    expect((await res.json()).affected).toBe(2);
    expect(mock.calls.some((c) => c.table === "projects" && c.verb === "delete")).toBe(true);
  });

  it("400 when status_update omits moderationStatus", async () => {
    viewer(adminUser, true, () => ({ error: null }));
    const res = await POST(req({ targetType: "project", ids: [ID_A], action: "status_update" }));
    expect(res.status).toBe(400);
  });

  it("bulk status_update writes the update and logs actions", async () => {
    const mock = viewer(adminUser, true, (table, verb) => {
      if (table === "projects" && verb === "select") return statusRows;
      return { error: null };
    });
    const res = await POST(req({ targetType: "project", ids: [ID_A, ID_B], action: "status_update", moderationStatus: "restricted" }));
    expect(res.status).toBe(200);
    expect((await res.json()).affected).toBe(2);
    const update = mock.calls.find((c) => c.table === "projects" && c.verb === "update");
    expect((update?.payload as { moderation_status: string }).moderation_status).toBe("restricted");
    expect(mock.calls.some((c) => c.table === "moderation_actions" && c.verb === "insert")).toBe(true);
  });
});
