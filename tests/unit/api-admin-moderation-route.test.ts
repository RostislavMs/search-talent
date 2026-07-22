import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
// The owner-notification path is best-effort and out of scope here; stub its deps.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ buildModerationDecisionEmail: vi.fn(() => ({ subject: "", html: "", text: "" })) }));

import { POST } from "@/app/api/admin/moderation/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(
  user: MockUser,
  isAdmin: boolean,
  resolve: (table: string, verb: string) => QueryResult,
): SupabaseMock {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: user as never,
    isAdmin,
    supabase: mock.client as never,
  } as never);
  return mock;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/admin/moderation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const approve = { targetType: "project", targetId: PROJECT_ID, moderationStatus: "approved" };

function targetResolver(table: string, verb: string): QueryResult {
  if (table === "projects" && verb === "select") {
    return { data: { id: PROJECT_ID, moderation_status: "under_review" } };
  }
  return { error: null };
}

afterEach(() => vi.clearAllMocks());

describe("POST /api/admin/moderation — gate", () => {
  it("401 when unauthenticated", async () => {
    viewer(null, false, () => ({}));
    expect((await POST(req(approve))).status).toBe(401);
  });

  it("403 when the caller is not an admin", async () => {
    viewer(adminUser, false, () => ({}));
    expect((await POST(req(approve))).status).toBe(403);
  });

  it("400 on an invalid payload", async () => {
    viewer(adminUser, true, targetResolver);
    expect((await POST(req({ targetType: "project", targetId: PROJECT_ID, moderationStatus: "bogus" }))).status).toBe(400);
  });

  it("404 when the target is missing", async () => {
    viewer(adminUser, true, (table) => (table === "projects" ? { data: null } : {}));
    expect((await POST(req(approve))).status).toBe(404);
  });
});

describe("POST /api/admin/moderation — actions", () => {
  it("updates the target and logs a moderation action", async () => {
    const mock = viewer(adminUser, true, targetResolver);
    const res = await POST(req(approve));
    expect(res.status).toBe(200);

    const update = mock.calls.find((c) => c.table === "projects" && c.verb === "update");
    expect((update?.payload as { moderation_status: string }).moderation_status).toBe("approved");
    expect(mock.calls.some((c) => c.table === "moderation_actions" && c.verb === "insert")).toBe(true);
  });

  it("maps a failed target update to 400", async () => {
    viewer(adminUser, true, (table, verb) => {
      if (table === "projects" && verb === "select") return { data: { id: PROJECT_ID, moderation_status: "approved" } };
      if (table === "projects" && verb === "update") return { error: { message: "update failed" } };
      return { error: null };
    });
    const res = await POST(req(approve));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("update failed");
  });

  it("triggers the owner-notification path when removing content", async () => {
    viewer(adminUser, true, targetResolver);
    const res = await POST(req({ targetType: "project", targetId: PROJECT_ID, moderationStatus: "removed" }));
    expect(res.status).toBe(200);
    // notifyContentOwner runs (createAdminClient stubbed to null → best-effort no-op).
    expect(vi.mocked(createAdminClient)).toHaveBeenCalled();
  });
});
