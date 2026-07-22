import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn() }));
vi.mock("@/lib/db/reactions", () => ({
  toggleReaction: vi.fn(),
  getReactionsForTargets: vi.fn(async () => ({})),
  findReactionTargetAuthor: vi.fn(async () => null),
}));

import { POST, GET } from "@/app/api/reactions/route";
import { rateLimit } from "@/lib/rate-limit";
import { toggleReaction, getReactionsForTargets } from "@/lib/db/reactions";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}
function postReq(body: unknown) {
  return new Request("http://test/api/reactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const payload = { target_type: "article", target_id: TARGET, emoji: "👍" };

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/reactions", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await POST(postReq(payload))).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    setUser(authUser);
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(postReq(payload))).status).toBe(429);
  });

  it("400 on an invalid payload", async () => {
    setUser(authUser);
    expect((await POST(postReq({ target_type: "article", target_id: "nope", emoji: "x" }))).status).toBe(400);
  });

  it("toggles the reaction and returns the updated summary", async () => {
    setUser(authUser);
    vi.mocked(toggleReaction).mockResolvedValue({ active: true } as never);
    vi.mocked(getReactionsForTargets).mockResolvedValue({ [TARGET]: [{ emoji: "👍", count: 1 }] } as never);
    const res = await POST(postReq(payload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.reactions).toEqual([{ emoji: "👍", count: 1 }]);
  });

  it("maps a toggle failure to 400", async () => {
    setUser(authUser);
    vi.mocked(toggleReaction).mockRejectedValue(new Error("bad emoji"));
    const res = await POST(postReq(payload));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad emoji");
  });
});

describe("GET /api/reactions", () => {
  it("400 on an invalid query", async () => {
    setUser(authUser);
    const res = await GET(new Request("http://test/api/reactions?target_type=bogus&ids=x"));
    expect(res.status).toBe(400);
  });

  it("returns the reaction map for valid ids", async () => {
    setUser(authUser);
    vi.mocked(getReactionsForTargets).mockResolvedValue({ [TARGET]: [] } as never);
    const res = await GET(new Request(`http://test/api/reactions?target_type=article&ids=${TARGET}`));
    expect(res.status).toBe(200);
    expect((await res.json()).reactions).toEqual({ [TARGET]: [] });
  });
});
