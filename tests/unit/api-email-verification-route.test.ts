import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/badges", () => ({ awardSqlBadgesForUser: vi.fn(async () => undefined) }));

import { POST } from "@/app/api/email-verification/route";
import { rateLimit } from "@/lib/rate-limit";
import { awardSqlBadgesForUser } from "@/lib/db/badges";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const confirmedUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const unconfirmedUser: MockUser = { id: USER_ID, email_confirmed_at: null };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/email-verification", () => {
  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await POST()).status).toBe(401);
  });

  it("429 when rate limited", async () => {
    setMock(confirmedUser);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await POST()).status).toBe(429);
  });

  it("returns verified=false (200) when auth email is not yet confirmed", async () => {
    setMock(unconfirmedUser);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verified: false });
    expect(vi.mocked(awardSqlBadgesForUser)).not.toHaveBeenCalled();
  });

  it("syncs the profile flag and re-awards badges when confirmed", async () => {
    const mock = setMock(confirmedUser);
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });

    const update = mock.calls.find((c) => c.table === "profiles" && c.verb === "update");
    expect(update).toBeDefined();
    expect(update?.payload).toMatchObject({ email_verified: true });
    expect(update?.filters).toContainEqual({ method: "eq", args: ["user_id", USER_ID] });
    expect(vi.mocked(awardSqlBadgesForUser)).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  it("400 when the profile update fails", async () => {
    setMock(confirmedUser, (table, verb) =>
      table === "profiles" && verb === "update" ? { error: { message: "db down" } } : {},
    );
    const res = await POST();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "db down" });
    expect(vi.mocked(awardSqlBadgesForUser)).not.toHaveBeenCalled();
  });
});
