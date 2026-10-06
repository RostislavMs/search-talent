import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/db/trash", () => ({
  deleteAccount: vi.fn(async () => ({ ok: true, groupId: "33333333-3333-4333-8333-333333333333" })),
}));

import { PATCH as articlePatch, DELETE as articleDelete } from "@/app/api/admin/articles/[id]/route";
import { PATCH as pollPatch } from "@/app/api/admin/polls/[id]/route";
import { DELETE as projectDelete } from "@/app/api/admin/projects/[id]/route";
import { DELETE as profileDelete } from "@/app/api/admin/profiles/[id]/route";
import { DELETE as feedbackDelete } from "@/app/api/admin/feedback/[id]/route";
import { deleteAccount } from "@/lib/db/trash";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(
  user: MockUser,
  isAdmin: boolean,
  resolve: (t: string, v: string) => QueryResult,
  rpc?: (fn: string, args?: unknown) => QueryResult,
): SupabaseMock {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb), rpc });
  vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  return mock;
}
const params = () => ({ params: Promise.resolve({ id: ID }) });
function patchReq(body: unknown) {
  return new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
const delReq = () => new Request("http://x", { method: "DELETE" });
const moderate = { moderation_status: "restricted" };

afterEach(() => vi.clearAllMocks());

describe("admin/articles/[id]", () => {
  it("PATCH 401/403 gate", async () => {
    viewer(null, false, () => ({}));
    expect((await articlePatch(patchReq(moderate), params())).status).toBe(401);
    viewer(adminUser, false, () => ({}));
    expect((await articlePatch(patchReq(moderate), params())).status).toBe(403);
  });

  it("PATCH 404 when missing", async () => {
    viewer(adminUser, true, (t) => (t === "articles" ? { data: null } : {}));
    expect((await articlePatch(patchReq(moderate), params())).status).toBe(404);
  });

  it("PATCH is one moderate_content call (the database stamps, logs and notifies)", async () => {
    const rpc = vi.fn<(fn: string, args?: unknown) => QueryResult>(() => ({
      data: { items: [{ id: ID, previousStatus: "approved", status: "restricted", changed: true }] },
    }));
    vi.mocked(createAdminClient).mockReturnValue(null as never);
    const mock = viewer(adminUser, true, () => ({ error: null }), rpc);
    expect((await articlePatch(patchReq({ ...moderate, moderation_note: "copied" }), params())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("moderate_content", {
      p_target_type: "article",
      p_target_ids: [ID],
      p_status: "restricted",
      p_note: "copied",
      p_report_id: null,
      p_report_status: null,
    });
    expect(mock.calls.some((c) => c.verb === "update")).toBe(false);
  });

  it("PATCH 404 when the article is gone", async () => {
    viewer(adminUser, true, () => ({}), () => ({ data: { items: [] } }));
    expect((await articlePatch(patchReq(moderate), params())).status).toBe(404);
  });

  it("DELETE removes the article", async () => {
    const mock = viewer(adminUser, true, (t, v) => (t === "articles" && v === "select" ? { data: { id: ID } } : { error: null }));
    expect((await articleDelete(delReq(), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "articles" && c.verb === "delete")).toBe(true);
  });
});

describe("admin/polls/[id] PATCH", () => {
  it("updates poll moderation through moderate_content", async () => {
    const rpc = vi.fn<(fn: string, args?: unknown) => QueryResult>(() => ({
      data: { items: [{ id: ID, previousStatus: "restricted", status: "restricted", changed: false }] },
    }));
    viewer(adminUser, true, () => ({}), rpc);
    expect((await pollPatch(patchReq(moderate), params())).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("moderate_content", expect.objectContaining({ p_target_type: "poll", p_status: "restricted" }));
  });

  it("passes the database's error on", async () => {
    viewer(adminUser, true, () => ({}), () => ({ data: null, error: { code: "22023", message: "invalid moderation status" } }));
    expect((await pollPatch(patchReq(moderate), params())).status).toBe(400);
  });

  it("403 for non-admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await pollPatch(patchReq(moderate), params())).status).toBe(403);
  });
});

describe("admin/projects/[id] DELETE", () => {
  it("403 for non-admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await projectDelete(delReq(), params())).status).toBe(403);
  });
  it("404 when missing", async () => {
    viewer(adminUser, true, (t) => (t === "projects" ? { data: null } : {}));
    expect((await projectDelete(delReq(), params())).status).toBe(404);
  });
  it("deletes the project (into the trash) without touching its files", async () => {
    const mock = viewer(adminUser, true, (t, v) => {
      if (t === "projects" && v === "select") return { data: { id: ID } };
      return { error: null };
    });
    expect((await projectDelete(delReq(), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "projects" && c.verb === "delete")).toBe(true);
    // Files go when the trash is emptied, so a restore keeps its images.
    expect(mock.calls.some((c) => c.table === "project_media")).toBe(false);
  });
});

describe("admin/profiles/[id] DELETE", () => {
  it("403 for non-admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await profileDelete(delReq(), params())).status).toBe(403);
  });
  it("400 when an admin targets their own profile", async () => {
    viewer(adminUser, true, (t) => (t === "profiles" ? { data: { id: ID, user_id: ADMIN_ID } } : {}));
    expect((await profileDelete(delReq(), params())).status).toBe(400);
  });
  it("500 when the admin client is unavailable", async () => {
    viewer(adminUser, true, (t) => (t === "profiles" ? { data: { id: ID, user_id: "other" } } : {}));
    vi.mocked(createAdminClient).mockReturnValue(null as never);
    expect((await profileDelete(delReq(), params())).status).toBe(500);
  });
  it("moves the account into the trash with the admin's own session", async () => {
    const mock = viewer(adminUser, true, (t) => (t === "profiles" ? { data: { id: ID, user_id: "other" } } : {}));
    vi.mocked(createAdminClient).mockReturnValue({ service: true } as never);
    expect((await profileDelete(delReq(), params())).status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(mock.client, "other", "erase");
  });
  it("maps a refusal from the database", async () => {
    viewer(adminUser, true, (t) => (t === "profiles" ? { data: { id: ID, user_id: "other" } } : {}));
    vi.mocked(createAdminClient).mockReturnValue({ service: true } as never);
    vi.mocked(deleteAccount).mockResolvedValueOnce({ ok: false, code: "already_deleted" });
    expect((await profileDelete(delReq(), params())).status).toBe(409);
    vi.mocked(deleteAccount).mockResolvedValueOnce({ ok: false, code: "forbidden" });
    expect((await profileDelete(delReq(), params())).status).toBe(403);
    vi.mocked(deleteAccount).mockResolvedValueOnce({ ok: false, code: "failed" });
    expect((await profileDelete(delReq(), params())).status).toBe(400);
  });
});

describe("admin/feedback/[id] DELETE", () => {
  it("403 for non-admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await feedbackDelete(delReq(), params())).status).toBe(403);
  });
  it("deletes feedback", async () => {
    const mock = viewer(adminUser, true, () => ({ error: null }));
    expect((await feedbackDelete(delReq(), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "feedback" && c.verb === "delete")).toBe(true);
  });
});
