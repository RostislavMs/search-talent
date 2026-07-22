import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));

import { POST } from "@/app/api/feedback/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
function req(body: unknown) {
  return new Request("http://test/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const valid = { category: "bug", message: "Something is broken" };

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/feedback", () => {
  it("429 when rate-limited", async () => {
    setMock(authUser, () => ({ error: null }));
    vi.mocked(rateLimit).mockReturnValueOnce({} as never); // truthy -> route returns its own 429
    expect((await POST(req(valid))).status).toBe(429);
  });

  it("400 on an invalid payload (empty message)", async () => {
    setMock(authUser, () => ({ error: null }));
    expect((await POST(req({ category: "bug", message: "" }))).status).toBe(400);
  });

  it("saves feedback from an authenticated user", async () => {
    const mock = setMock(authUser, () => ({ error: null }));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "feedback" && c.verb === "insert");
    expect((insert?.payload as { user_id: string | null }).user_id).toBe(USER_ID);
  });

  it("accepts anonymous feedback (user_id null)", async () => {
    const mock = setMock(null, () => ({ error: null }));
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "feedback" && c.verb === "insert");
    expect((insert?.payload as { user_id: string | null }).user_id).toBeNull();
  });

  it("500 when the insert fails", async () => {
    setMock(authUser, () => ({ error: { message: "db down" } }));
    expect((await POST(req(valid))).status).toBe(500);
  });
});
