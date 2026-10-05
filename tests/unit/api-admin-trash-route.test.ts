import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/db/trash", () => ({
  restoreTrashGroup: vi.fn(async () => ({ ok: true, restored: 8, accountUserId: null })),
  eraseTrashGroup: vi.fn(async () => ({ ok: true, accountUserId: null })),
}));

import { DELETE, POST } from "@/app/api/admin/trash/[group]/route";
import { eraseTrashGroup, restoreTrashGroup } from "@/lib/db/trash";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const GROUP = "22222222-2222-4222-8222-222222222222";
const SUPABASE = { session: true };
const params = (group = GROUP) => ({ params: Promise.resolve({ group }) });
const req = (method: string) => new Request("http://x", { method });

function asViewer(user: { id: string } | null, isAdmin: boolean) {
  vi.mocked(getCurrentViewerRole).mockResolvedValue({ user, isAdmin, supabase: SUPABASE } as never);
}

afterEach(() => vi.clearAllMocks());

describe("/api/admin/trash/[group]", () => {
  it("400 for a malformed id", async () => {
    asViewer({ id: "a" }, true);
    expect((await POST(req("POST"), params("nope"))).status).toBe(400);
    expect(restoreTrashGroup).not.toHaveBeenCalled();
  });

  it("401 signed out, 403 for a non-admin", async () => {
    asViewer(null, false);
    expect((await POST(req("POST"), params())).status).toBe(401);
    asViewer({ id: "a" }, false);
    expect((await DELETE(req("DELETE"), params())).status).toBe(403);
    expect(eraseTrashGroup).not.toHaveBeenCalled();
  });

  it("POST restores with the admin's session", async () => {
    asViewer({ id: "a" }, true);
    const res = await POST(req("POST"), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, restored: 8, accountUserId: null });
    expect(restoreTrashGroup).toHaveBeenCalledWith(SUPABASE, GROUP);
  });

  it("DELETE erases with the admin's session", async () => {
    asViewer({ id: "a" }, true);
    const res = await DELETE(req("DELETE"), params());
    expect(res.status).toBe(200);
    expect((await res.json()).restored).toBeNull();
    expect(eraseTrashGroup).toHaveBeenCalledWith(SUPABASE, GROUP);
  });

  it.each([
    ["conflict", 409],
    ["missing_parent", 409],
    ["not_found", 404],
    ["forbidden", 403],
    ["failed", 500],
  ] as const)("a %s failure answers %i with its code", async (code, status) => {
    asViewer({ id: "a" }, true);
    vi.mocked(restoreTrashGroup).mockResolvedValueOnce({ ok: false, code, table: code === "conflict" ? "projects" : null });
    const res = await POST(req("POST"), params());
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.code).toBe(code);
  });
});
