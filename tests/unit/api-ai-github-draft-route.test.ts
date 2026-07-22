import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/github-integrations", () => ({ getIntegrationForUser: vi.fn() }));
vi.mock("@/lib/integrations/github", () => ({ fetchRepoFullDetail: vi.fn() }));
vi.mock("@/lib/ai/github-draft", () => ({ generateGithubDraft: vi.fn() }));
vi.mock("@/lib/ai/usage", () => ({ logAiUsage: vi.fn() }));
vi.mock("@/lib/ai/gemini-client", () => {
  class GeminiNotConfiguredError extends Error {}
  return { GeminiNotConfiguredError, isGeminiConfigured: vi.fn(() => true) };
});

import { POST } from "@/app/api/ai/github-draft/route";
import { rateLimit } from "@/lib/rate-limit";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { generateGithubDraft } from "@/lib/ai/github-draft";
import { isGeminiConfigured, GeminiNotConfiguredError } from "@/lib/ai/gemini-client";

const authUser: MockUser = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}
function req(body: unknown = { fullName: "octocat/hello-world" }) {
  return new Request("http://test/api/ai/github-draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const integration = { access_token: "tok", github_login: "octocat" };

beforeEach(() => {
  vi.mocked(isGeminiConfigured).mockReturnValue(true);
  vi.mocked(rateLimit).mockReturnValue(null);
  vi.mocked(getIntegrationForUser).mockResolvedValue(integration as never);
  vi.mocked(fetchRepoFullDetail).mockResolvedValue({ name: "hello-world" } as never);
  vi.mocked(generateGithubDraft).mockResolvedValue({
    data: { problem: "p" }, model: "m", inputTokens: 1, outputTokens: 2, durationMs: 3,
  } as never);
});
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/ai/github-draft", () => {
  it("503 when Gemini is not configured", async () => {
    vi.mocked(isGeminiConfigured).mockReturnValue(false);
    setUser(authUser);
    expect((await POST(req())).status).toBe(503);
  });

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    setUser(authUser);
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req())).status).toBe(429);
  });

  it("400 on an invalid repo identifier", async () => {
    setUser(authUser);
    expect((await POST(req({ fullName: "not-a-repo" }))).status).toBe(400);
  });

  it("409 when GitHub is not connected", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValue(null as never);
    expect((await POST(req())).status).toBe(409);
  });

  it("404 when the repo is unreachable", async () => {
    setUser(authUser);
    vi.mocked(fetchRepoFullDetail).mockResolvedValue(null as never);
    expect((await POST(req())).status).toBe(404);
  });

  it("returns the generated draft", async () => {
    setUser(authUser);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect((await res.json()).draft).toEqual({ problem: "p" });
  });

  it("maps a generic generation error to 502", async () => {
    setUser(authUser);
    vi.mocked(generateGithubDraft).mockRejectedValue(new Error("boom"));
    expect((await POST(req())).status).toBe(502);
  });

  it("maps a GeminiNotConfiguredError to 503", async () => {
    setUser(authUser);
    vi.mocked(generateGithubDraft).mockRejectedValue(new GeminiNotConfiguredError());
    expect((await POST(req())).status).toBe(503);
  });
});
