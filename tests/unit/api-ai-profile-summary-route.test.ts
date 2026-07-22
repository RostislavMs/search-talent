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
vi.mock("@/lib/ai/profile-summary", () => ({ generateProfileSummary: vi.fn() }));
vi.mock("@/lib/ai/usage", () => ({ logAiUsage: vi.fn() }));
vi.mock("@/lib/ai/gemini-client", () => {
  class GeminiNotConfiguredError extends Error {}
  return { GeminiNotConfiguredError, isGeminiConfigured: vi.fn(() => true) };
});

import { POST } from "@/app/api/ai/profile-summary/route";
import { rateLimit } from "@/lib/rate-limit";
import { generateProfileSummary } from "@/lib/ai/profile-summary";
import { isGeminiConfigured, GeminiNotConfiguredError } from "@/lib/ai/gemini-client";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
}

function req(body: unknown = { username: "ada" }) {
  return new Request("http://test/api/ai/profile-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A profile owned by the caller, plus empty skills/projects/articles.
function ownerResolver(userId: string) {
  return (table: string): QueryResult => {
    if (table === "profiles") {
      return { data: { id: "p1", user_id: userId, username: "ada", moderation_status: "approved" } };
    }
    return { data: [] };
  };
}

const summaryOk = {
  data: { summary: "A concise two-sentence summary." },
  model: "gemini-x",
  inputTokens: 10,
  outputTokens: 20,
  durationMs: 30,
};

beforeEach(() => {
  vi.mocked(isGeminiConfigured).mockReturnValue(true);
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(generateProfileSummary).mockResolvedValue(summaryOk as never);
});
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/ai/profile-summary", () => {
  it("503 when Gemini is not configured", async () => {
    vi.mocked(isGeminiConfigured).mockReturnValue(false);
    setMock(authUser, () => ({}));
    expect((await POST(req())).status).toBe(503);
  });

  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req())).status).toBe(401);
  });

  it("returns the viewer rate-limit response when limited", async () => {
    setMock(authUser, ownerResolver(USER_ID));
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req())).status).toBe(429);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, ownerResolver(USER_ID));
    expect((await POST(req({ username: "" }))).status).toBe(400);
  });

  it("404 when the profile does not exist", async () => {
    setMock(authUser, (table) => (table === "profiles" ? { data: null } : { data: [] }));
    expect((await POST(req())).status).toBe(404);
  });

  it("404 for a moderated-away profile viewed by a non-owner", async () => {
    setMock(authUser, (table) =>
      table === "profiles"
        ? { data: { id: "p1", user_id: OTHER, username: "ada", moderation_status: "removed" } }
        : { data: [] },
    );
    expect((await POST(req())).status).toBe(404);
  });

  it("returns the generated summary for the owner", async () => {
    setMock(authUser, ownerResolver(USER_ID));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).summary).toBe("A concise two-sentence summary.");
    expect(vi.mocked(generateProfileSummary)).toHaveBeenCalledOnce();
  });

  it("maps a generic generation error to 502", async () => {
    setMock(authUser, ownerResolver(USER_ID));
    vi.mocked(generateProfileSummary).mockRejectedValue(new Error("model exploded"));
    expect((await POST(req())).status).toBe(502);
  });

  it("maps a GeminiNotConfiguredError to 503", async () => {
    setMock(authUser, ownerResolver(USER_ID));
    vi.mocked(generateProfileSummary).mockRejectedValue(new GeminiNotConfiguredError());
    expect((await POST(req())).status).toBe(503);
  });
});
