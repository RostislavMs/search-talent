import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type QueryResult } from "./helpers/supabase-mock";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/moderation-actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/moderation-actions")>()),
  emailModerationDecisions: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/admin/moderation/route";
import { emailModerationDecisions } from "@/lib/db/moderation-actions";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const REPORT_ID = "44444444-4444-4444-8444-444444444444";

const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(user: MockUser, isAdmin: boolean, rpc: (fn: string, args?: unknown) => QueryResult = () => ({})) {
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

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/admin/moderation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const decided = (status: string, previousStatus = "approved") => () => ({
  data: { items: [{ id: PROJECT_ID, previousStatus, status, changed: previousStatus !== status }] },
});

afterEach(() => vi.clearAllMocks());

describe("POST /api/admin/moderation — gate", () => {
  const approve = { targetType: "project", targetId: PROJECT_ID, moderationStatus: "approved" };

  it("401 when unauthenticated", async () => {
    viewer(null, false);
    expect((await POST(req(approve))).status).toBe(401);
  });

  it("403 when the caller is not an admin", async () => {
    const calls = viewer(adminUser, false);
    expect((await POST(req(approve))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("400 on an invalid payload", async () => {
    viewer(adminUser, true);
    expect((await POST(req({ ...approve, moderationStatus: "bogus" }))).status).toBe(400);
  });

  it("404 when there is nothing to decide on", async () => {
    viewer(adminUser, true, () => ({ data: { items: [] } }));
    expect((await POST(req(approve))).status).toBe(404);
  });
});

describe("POST /api/admin/moderation — decisions", () => {
  it("is one moderate_content call, with the report", async () => {
    const calls = viewer(adminUser, true, decided("removed"));
    const res = await POST(
      req({
        targetType: "project",
        targetId: PROJECT_ID,
        moderationStatus: "removed",
        reportId: REPORT_ID,
        reportStatus: "resolved",
        resolutionNote: "  spam  ",
      }),
    );
    expect(res.status).toBe(200);
    expect(calls).toEqual([
      {
        fn: "moderate_content",
        args: {
          p_target_type: "project",
          p_target_ids: [PROJECT_ID],
          p_status: "removed",
          p_note: "spam",
          p_report_id: REPORT_ID,
          p_report_status: "resolved",
        },
      },
    ]);
    expect(emailModerationDecisions).toHaveBeenCalledWith({
      targetType: "project",
      items: [{ id: PROJECT_ID, previousStatus: "approved", status: "removed", changed: true }],
      note: "spam",
    });
  });

  it("answers a report on a comment that is already gone", async () => {
    viewer(adminUser, true, () => ({ data: { items: [] } }));
    const res = await POST(
      req({
        targetType: "project_comment",
        targetId: PROJECT_ID,
        moderationStatus: "approved",
        reportId: REPORT_ID,
        reportStatus: "dismissed",
      }),
    );
    expect(res.status).toBe(200);
  });

  it.each([
    [{ code: "42501", message: "only platform admins moderate content" }, 403],
    [{ code: "P0002", message: "report not found" }, 404],
    [{ code: "22023", message: "a comment is kept or removed" }, 400],
  ])("maps the database's %o to %i", async (error, status) => {
    viewer(adminUser, true, () => ({ data: null, error }));
    const res = await POST(req({ targetType: "project", targetId: PROJECT_ID, moderationStatus: "removed" }));
    expect(res.status).toBe(status);
    expect(emailModerationDecisions).not.toHaveBeenCalled();
  });
});
