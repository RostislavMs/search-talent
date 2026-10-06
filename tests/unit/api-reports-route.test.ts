import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));

import { POST } from "@/app/api/reports/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, rpc: (fn: string, args?: unknown) => QueryResult = () => ({ data: { id: "r1" } })) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  holder.mock = createSupabaseMock({
    user,
    resolve: () => ({}),
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return rpc(fn, args);
    },
  });
  return calls;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/reports", () => {
  it("401 for guests", async () => {
    setMock(null);
    expect((await POST(req({ targetType: "project", targetId: TARGET_ID, reason: "other" }))).status).toBe(401);
  });

  it("400 for an invalid payload", async () => {
    const calls = setMock(authUser);
    expect((await POST(req({ targetType: "feedback", targetId: TARGET_ID, reason: "other" }))).status).toBe(400);
    expect((await POST(req({ targetType: "project", targetId: "nope", reason: "other" }))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it.each(["profile", "project", "article", "poll", "company", "vacancy", "project_comment", "article_comment", "poll_comment"])(
    "files a %s report through submit_report",
    async (targetType) => {
      const calls = setMock(authUser);
      const res = await POST(req({ targetType, targetId: TARGET_ID, reason: "spam_or_scam", details: "  links  " }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });
      expect(calls).toEqual([
        {
          fn: "submit_report",
          args: { p_target_type: targetType, p_target_id: TARGET_ID, p_reason: "spam_or_scam", p_details: "links" },
        },
      ]);
    },
  );

  it.each([
    [{ code: "P0002", message: "report_target_not_found" }, 404, "Content not found"],
    [{ code: "42501", message: "cannot_report_own_content" }, 400, "You cannot report your own content"],
    [{ code: "23505", message: "duplicate_report" }, 409, "A similar active report already exists"],
    [{ code: "23505", message: "duplicate key value violates unique constraint" }, 409, "A similar active report already exists"],
    [{ code: "P0001", message: "report_rate_limited" }, 429, "Too many reports. Try again in a minute."],
    [{ code: "23514", message: "report details are too long" }, 400, "report details are too long"],
  ])("maps the database's %o to %i", async (error, status, message) => {
    setMock(authUser, () => ({ data: null, error }));
    const res = await POST(req({ targetType: "project", targetId: TARGET_ID, reason: "other" }));
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
  });
});
