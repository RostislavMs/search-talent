import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { POST, DELETE } from "@/app/api/admin/users/[id]/admin-role/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";

const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setViewer(user: MockUser, isAdmin: boolean) {
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: user as never,
    isAdmin,
    supabase: {} as never,
  } as never);
}

function setAdminClient(resolve: (table: string, verb: string) => QueryResult): SupabaseMock {
  const mock = createSupabaseMock({ resolve: (c) => resolve(c.table, c.verb) });
  vi.mocked(createAdminClient).mockReturnValue(mock.client as never);
  return mock;
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string) =>
  new Request(`http://test/api/admin/users/x/admin-role`, { method });

afterEach(() => vi.clearAllMocks());

describe("admin-role — gate", () => {
  it("401 when unauthenticated", async () => {
    setViewer(null, false);
    expect((await POST(req("POST"), paramsFor(TARGET_ID))).status).toBe(401);
  });

  it("403 when the caller is not an admin", async () => {
    setViewer(adminUser, false);
    expect((await POST(req("POST"), paramsFor(TARGET_ID))).status).toBe(403);
  });

  it("400 for a non-uuid target id", async () => {
    setViewer(adminUser, true);
    expect((await POST(req("POST"), paramsFor("not-a-uuid"))).status).toBe(400);
  });
});

describe("admin-role — self-modification guard", () => {
  it("400 when an admin grants themselves (POST)", async () => {
    setViewer(adminUser, true);
    const res = await POST(req("POST"), paramsFor(ADMIN_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own admin role/i);
    expect(vi.mocked(createAdminClient)).not.toHaveBeenCalled();
  });

  it("400 when an admin revokes themselves (DELETE)", async () => {
    setViewer(adminUser, true);
    const res = await DELETE(req("DELETE"), paramsFor(ADMIN_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own admin role/i);
  });
});

describe("admin-role — mutations", () => {
  it("500 when the service-role client is unavailable", async () => {
    setViewer(adminUser, true);
    vi.mocked(createAdminClient).mockReturnValue(null as never);
    expect((await POST(req("POST"), paramsFor(TARGET_ID))).status).toBe(500);
  });

  it("grants the role by upserting into platform_admins", async () => {
    setViewer(adminUser, true);
    const mock = setAdminClient(() => ({ error: null }));
    const res = await POST(req("POST"), paramsFor(TARGET_ID));
    expect(res.status).toBe(200);
    const upsert = mock.calls.find((c) => c.table === "platform_admins" && c.verb === "upsert");
    expect(upsert?.payload).toMatchObject({ user_id: TARGET_ID });
  });

  it("revokes the role by deleting from platform_admins", async () => {
    setViewer(adminUser, true);
    const mock = setAdminClient(() => ({ error: null }));
    const res = await DELETE(req("DELETE"), paramsFor(TARGET_ID));
    expect(res.status).toBe(200);
    const del = mock.calls.find((c) => c.table === "platform_admins" && c.verb === "delete");
    expect(del?.filters).toContainEqual({ method: "eq", args: ["user_id", TARGET_ID] });
  });

  it("maps a mutation error to 400", async () => {
    setViewer(adminUser, true);
    setAdminClient(() => ({ error: { message: "boom" } }));
    const res = await POST(req("POST"), paramsFor(TARGET_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("boom");
  });
});
