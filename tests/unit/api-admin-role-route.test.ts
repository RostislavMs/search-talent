import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type QueryResult } from "./helpers/supabase-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));

import { POST, DELETE } from "@/app/api/admin/users/[id]/admin-role/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";

const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

/** The admin's own session; set_platform_admin answers through `rpc`. */
function setViewer(
  user: MockUser,
  isAdmin: boolean,
  rpc: (fn: string, args?: unknown) => QueryResult = () => ({ data: { changed: true } }),
) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const mock = createSupabaseMock({
    user,
    resolve: () => ({}),
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return rpc(fn, args);
    },
  });
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: user as never,
    isAdmin,
    supabase: mock.client as never,
  } as never);
  return calls;
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string) => new Request(`http://test/api/admin/users/x/admin-role`, { method });

afterEach(() => vi.clearAllMocks());

describe("admin-role — gate", () => {
  it("401 when unauthenticated", async () => {
    setViewer(null, false);
    expect((await POST(req("POST"), paramsFor(TARGET_ID))).status).toBe(401);
  });

  it("403 when the caller is not an admin", async () => {
    const calls = setViewer(adminUser, false);
    expect((await POST(req("POST"), paramsFor(TARGET_ID))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("400 for a non-uuid target id", async () => {
    setViewer(adminUser, true);
    expect((await POST(req("POST"), paramsFor("not-a-uuid"))).status).toBe(400);
  });
});

describe("admin-role — set_platform_admin", () => {
  it("grants with the admin's own session", async () => {
    const calls = setViewer(adminUser, true);
    const res = await POST(req("POST"), paramsFor(TARGET_ID));
    expect(res.status).toBe(200);
    expect(calls).toEqual([{ fn: "set_platform_admin", args: { p_user_id: TARGET_ID, p_admin: true } }]);
  });

  it("revokes", async () => {
    const calls = setViewer(adminUser, true);
    expect((await DELETE(req("DELETE"), paramsFor(TARGET_ID))).status).toBe(200);
    expect(calls[0]).toEqual({ fn: "set_platform_admin", args: { p_user_id: TARGET_ID, p_admin: false } });
  });

  it.each([
    [{ code: "42501", message: "cannot_change_own_admin_role" }, 400, "Cannot modify your own admin role"],
    [{ code: "P0002", message: "user_not_found" }, 404, "User not found"],
    [{ code: "P0001", message: "last_admin" }, 409, "The last admin cannot be removed"],
    [{ code: "42501", message: "only platform admins manage admins" }, 403, "only platform admins manage admins"],
    [{ code: "XX000", message: "boom" }, 400, "boom"],
  ])("maps the database's %o to %i", async (error, status, message) => {
    setViewer(adminUser, true, () => ({ data: null, error }));
    const res = await DELETE(req("DELETE"), paramsFor(TARGET_ID));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
  });
});
