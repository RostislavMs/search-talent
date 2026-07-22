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
vi.mock("@/lib/db/polls", () => ({ getPollResults: vi.fn(async () => ({ questions: [] })) }));

import { POST } from "@/app/api/polls/[id]/vote/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const POLL_ID = "22222222-2222-4222-8222-222222222222";
const Q_ID = "33333333-3333-4333-8333-333333333333";
const OPT_ID = "44444444-4444-4444-8444-444444444444";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, rpc?: () => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}), rpc });
  return holder.mock;
}
const params = () => ({ params: Promise.resolve({ id: POLL_ID }) });
function req(body: unknown) {
  return new Request(`http://test/api/polls/${POLL_ID}/vote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const validVote = { answers: [{ question_id: Q_ID, option_ids: [OPT_ID] }] };

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/polls/[id]/vote", () => {
  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await POST(req(validVote), params())).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    setMock(authUser, () => ({ error: null }));
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req(validVote), params())).status).toBe(429);
  });

  it("400 on an invalid ballot (no answers)", async () => {
    setMock(authUser, () => ({ error: null }));
    expect((await POST(req({ answers: [] }), params())).status).toBe(400);
  });

  it("400 when the cast_poll_vote RPC rejects the ballot", async () => {
    setMock(authUser, () => ({ error: { message: "poll is closed" } }));
    const res = await POST(req(validVote), params());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("poll is closed");
  });

  it("casts the vote and returns results", async () => {
    const rpc = vi.fn(() => ({ error: null }));
    setMock(authUser, rpc);
    const res = await POST(req(validVote), params());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalled();
    expect((await res.json()).success).toBe(true);
  });
});
