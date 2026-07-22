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

import { POST } from "@/app/api/bookmarks/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TARGET = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
function req(body: unknown) {
  return new Request("http://test/api/bookmarks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const payload = { targetType: "project", targetId: TARGET };

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/bookmarks", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req(payload))).status).toBe(401);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, () => ({}));
    expect((await POST(req({ targetType: "project", targetId: "nope" }))).status).toBe(400);
  });

  it("removes an existing bookmark (toggle off)", async () => {
    const mock = setMock(authUser, (table, verb) => {
      if (table === "bookmarks" && verb === "select") return { data: { id: "b1" } };
      return { error: null };
    });
    const res = await POST(req(payload));
    expect((await res.json()).bookmarked).toBe(false);
    expect(mock.calls.some((c) => c.table === "bookmarks" && c.verb === "delete")).toBe(true);
  });

  it("adds a bookmark when none exists", async () => {
    const mock = setMock(authUser, (table, verb) => {
      if (table === "bookmarks" && verb === "select") return { data: null };
      return { error: null };
    });
    const res = await POST(req(payload));
    expect((await res.json()).bookmarked).toBe(true);
    const insert = mock.calls.find((c) => c.table === "bookmarks" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({ user_id: USER_ID, target_type: "project", target_project_id: TARGET });
  });
});
