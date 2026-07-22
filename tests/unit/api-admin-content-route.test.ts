import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/storage/provider", () => ({ deleteStorageObject: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { PATCH as articlePatch, DELETE as articleDelete } from "@/app/api/admin/articles/[id]/route";
import { PATCH as pollPatch } from "@/app/api/admin/polls/[id]/route";
import { DELETE as projectDelete } from "@/app/api/admin/projects/[id]/route";
import { DELETE as profileDelete } from "@/app/api/admin/profiles/[id]/route";
import { DELETE as feedbackDelete } from "@/app/api/admin/feedback/[id]/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(user: MockUser, isAdmin: boolean, resolve: (t: string, v: string) => QueryResult): SupabaseMock {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
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

  it("PATCH updates moderation status", async () => {
    const mock = viewer(adminUser, true, (t, v) => (t === "articles" && v === "select" ? { data: { id: ID } } : { error: null }));
    expect((await articlePatch(patchReq(moderate), params())).status).toBe(200);
    const update = mock.calls.find((c) => c.table === "articles" && c.verb === "update");
    expect((update?.payload as { moderation_status: string }).moderation_status).toBe("restricted");
  });

  it("DELETE removes the article", async () => {
    const mock = viewer(adminUser, true, (t, v) => (t === "articles" && v === "select" ? { data: { id: ID } } : { error: null }));
    expect((await articleDelete(delReq(), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "articles" && c.verb === "delete")).toBe(true);
  });
});

describe("admin/polls/[id] PATCH", () => {
  it("updates poll moderation status", async () => {
    const mock = viewer(adminUser, true, (t, v) => (t === "polls" && v === "select" ? { data: { id: ID } } : { error: null }));
    expect((await pollPatch(patchReq(moderate), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "polls" && c.verb === "update")).toBe(true);
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
  it("deletes the project", async () => {
    const mock = viewer(adminUser, true, (t, v) => {
      if (t === "projects" && v === "select") return { data: { id: ID } };
      if (t === "project_media") return { data: [] };
      return { error: null };
    });
    expect((await projectDelete(delReq(), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "projects" && c.verb === "delete")).toBe(true);
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
  it("deletes the underlying auth user", async () => {
    viewer(adminUser, true, (t) => (t === "profiles" ? { data: { id: ID, user_id: "other" } } : {}));
    const deleteUser = vi.fn(async () => ({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue({ auth: { admin: { deleteUser } } } as never);
    expect((await profileDelete(delReq(), params())).status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith("other");
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
