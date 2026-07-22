import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => holder.mock!.client),
}));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/db/profile-votes", () => ({
  getProfileVoteSummary: vi.fn(async () => ({ likes: 2, dislikes: 0, currentVote: 1 })),
}));
vi.mock("@/lib/db/leaderboards", () => ({ LEADERBOARDS_CACHE_TAG: "leaderboards" }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST } from "@/app/api/profile-vote/route";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OWNER = "33333333-3333-4333-8333-333333333333";

const confirmedUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00.000Z" };

function setMock(user: MockUser, resolve: (table: string, verb: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (call) => resolve(call.table, call.verb) });
  return holder.mock;
}

function req(body: unknown): Request {
  return new Request("http://test/api/profile-vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const someoneElsesProfile = (table: string): QueryResult =>
  table === "profiles" ? { data: { id: PROFILE_ID, user_id: OTHER_OWNER } } : {};

beforeEach(() => {
  vi.mocked(dbRateLimit).mockResolvedValue(null);
});
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/profile-vote — guards", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req({ profileId: PROFILE_ID, value: 1 }))).status).toBe(401);
  });

  it("403 when email unconfirmed", async () => {
    setMock({ id: USER_ID, email_confirmed_at: null }, () => ({}));
    expect((await POST(req({ profileId: PROFILE_ID, value: 1 }))).status).toBe(403);
  });

  it("400 on invalid value", async () => {
    setMock(confirmedUser, () => ({}));
    expect((await POST(req({ profileId: PROFILE_ID, value: 0 }))).status).toBe(400);
  });

  it("404 when the profile is missing", async () => {
    setMock(confirmedUser, (table) => (table === "profiles" ? { data: null } : {}));
    expect((await POST(req({ profileId: PROFILE_ID, value: 1 }))).status).toBe(404);
  });

  it("400 when rating your own profile", async () => {
    setMock(confirmedUser, (table) =>
      table === "profiles" ? { data: { id: PROFILE_ID, user_id: USER_ID } } : {},
    );
    const res = await POST(req({ profileId: PROFILE_ID, value: 1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own profile/i);
  });
});

describe("POST /api/profile-vote — mutations", () => {
  it("inserts a new vote attributed to the caller", async () => {
    const mock = setMock(confirmedUser, (table, verb) => {
      if (table === "profiles") return someoneElsesProfile(table);
      if (table === "profile_votes" && verb === "select") return { data: [] };
      return { error: null };
    });
    const res = await POST(req({ profileId: PROFILE_ID, value: 1 }));
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "profile_votes" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({ profile_id: PROFILE_ID, user_id: USER_ID, value: 1 });
  });

  it("toggles off on a repeated value", async () => {
    const mock = setMock(confirmedUser, (table, verb) => {
      if (table === "profiles") return someoneElsesProfile(table);
      if (table === "profile_votes" && verb === "select") return { data: [{ value: 1 }] };
      return { error: null };
    });
    expect((await POST(req({ profileId: PROFILE_ID, value: 1 }))).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "profile_votes" && c.verb === "delete")).toBe(true);
  });

  it("maps the missing-table error to a setup hint", async () => {
    setMock(confirmedUser, (table, verb) => {
      if (table === "profiles") return someoneElsesProfile(table);
      if (table === "profile_votes" && verb === "select") {
        return { error: { message: "Could not find the table 'public.profile_votes' in the schema cache" } };
      }
      return { error: null };
    });
    const res = await POST(req({ profileId: PROFILE_ID, value: 1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/migration first/i);
  });
});
