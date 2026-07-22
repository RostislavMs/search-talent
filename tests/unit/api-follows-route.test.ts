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
// Notification side-channels are fire-and-forget; stub them so imports are light.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ buildNewFollowerEmail: vi.fn(() => ({ subject: "", html: "", text: "" })) }));
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://site" }));

import { POST } from "@/app/api/follows/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
function req(body: unknown) {
  return new Request("http://test/api/follows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/follows", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req({ followingUserId: TARGET }))).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    setMock(authUser, () => ({}));
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req({ followingUserId: TARGET }))).status).toBe(429);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, () => ({}));
    expect((await POST(req({ followingUserId: "nope" }))).status).toBe(400);
  });

  it("400 when trying to follow yourself", async () => {
    setMock(authUser, () => ({}));
    const res = await POST(req({ followingUserId: USER_ID }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/yourself/i);
  });

  it("unfollows when a follow already exists", async () => {
    const mock = setMock(authUser, (table, verb) => {
      if (table === "follows" && verb === "select") return { data: { id: "f1" } };
      return { error: null };
    });
    const res = await POST(req({ followingUserId: TARGET }));
    expect((await res.json()).following).toBe(false);
    expect(mock.calls.some((c) => c.table === "follows" && c.verb === "delete")).toBe(true);
  });

  it("follows when none exists yet", async () => {
    const mock = setMock(authUser, (table, verb) => {
      if (table === "follows" && verb === "select") return { data: null };
      return { error: null };
    });
    const res = await POST(req({ followingUserId: TARGET }));
    expect((await res.json()).following).toBe(true);
    const insert = mock.calls.find((c) => c.table === "follows" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({ follower_user_id: USER_ID, following_user_id: TARGET });
  });
});
