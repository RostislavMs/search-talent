import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));

import { POST } from "@/app/api/reports/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "99999999-9999-4999-8999-999999999999";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (table: string, verb: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A project owned by someone else, not under review, with no existing report.
function cleanTargetResolver(table: string, verb: string): QueryResult {
  if (table === "projects" && verb === "select") {
    return { data: { id: PROJECT_ID, owner_id: OWNER_ID, moderation_status: "approved" } };
  }
  if (table === "content_reports" && verb === "select") return { data: null };
  if (table === "content_reports" && verb === "insert") return { error: null };
  return { error: null };
}

const spamReport = { targetType: "project", targetId: PROJECT_ID, reason: "spam_or_scam" };
const urgentReport = { targetType: "project", targetId: PROJECT_ID, reason: "harmful_or_dangerous" };

beforeEach(() => {
  vi.mocked(rateLimit).mockReturnValue(null);
});
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/reports — guards", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req(spamReport))).status).toBe(401);
  });

  it("429 when rate-limited", async () => {
    setMock(authUser, cleanTargetResolver);
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req(spamReport))).status).toBe(429);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, cleanTargetResolver);
    expect((await POST(req({ targetType: "project", targetId: PROJECT_ID, reason: "nope" }))).status).toBe(400);
  });

  it("404 when the target does not exist", async () => {
    setMock(authUser, (table) => (table === "projects" ? { data: null } : {}));
    expect((await POST(req(spamReport))).status).toBe(404);
  });

  it("400 when reporting your own content", async () => {
    setMock(authUser, (table) =>
      table === "projects"
        ? { data: { id: PROJECT_ID, owner_id: USER_ID, moderation_status: "approved" } }
        : {},
    );
    const res = await POST(req(spamReport));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own content/i);
  });

  it("409 on a duplicate active report", async () => {
    setMock(authUser, (table, verb) => {
      if (table === "projects") return { data: { id: PROJECT_ID, owner_id: OWNER_ID, moderation_status: "approved" } };
      if (table === "content_reports" && verb === "select") return { data: { id: "dup" } };
      return {};
    });
    expect((await POST(req(spamReport))).status).toBe(409);
  });
});

describe("POST /api/reports — creation", () => {
  it("inserts a report and does not auto-review a non-urgent reason", async () => {
    const mock = setMock(authUser, cleanTargetResolver);
    const res = await POST(req(spamReport));
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "content_reports" && c.verb === "insert")).toBe(true);
    // spam_or_scam is "high", not "urgent" → target is NOT moved to review.
    expect(mock.calls.some((c) => c.table === "projects" && c.verb === "update")).toBe(false);
  });

  it("moves the target to under_review on an urgent reason", async () => {
    const mock = setMock(authUser, cleanTargetResolver);
    const res = await POST(req(urgentReport));
    expect(res.status).toBe(200);
    const update = mock.calls.find((c) => c.table === "projects" && c.verb === "update");
    expect((update?.payload as { moderation_status: string }).moderation_status).toBe("under_review");
  });
});
