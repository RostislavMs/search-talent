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

import { GET, POST, DELETE } from "@/app/api/saved-searches/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
function postReq(body: unknown) {
  return new Request("http://test/api/saved-searches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const validSearch = { name: "My filter", mode: "projects", params: { q: "react" } };

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/saved-searches", () => {
  it("returns an empty list for anonymous callers (no 401)", async () => {
    setMock(null, () => ({}));
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).searches).toEqual([]);
  });

  it("lists the current user's saved searches", async () => {
    setMock(authUser, (t) => (t === "saved_searches" ? { data: [{ id: "s1", name: "x" }] } : {}));
    const res = await GET();
    expect((await res.json()).searches).toEqual([{ id: "s1", name: "x" }]);
  });
});

describe("POST /api/saved-searches", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(postReq(validSearch))).status).toBe(401);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, () => ({}));
    expect((await POST(postReq({ name: "", mode: "projects", params: {} }))).status).toBe(400);
  });

  it("saves the search", async () => {
    const mock = setMock(authUser, (t, v) =>
      t === "saved_searches" && v === "insert" ? { data: { id: "s1", ...validSearch } } : {},
    );
    const res = await POST(postReq(validSearch));
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "saved_searches" && c.verb === "insert");
    expect((insert?.payload as { user_id: string }).user_id).toBe(USER_ID);
  });
});

describe("DELETE /api/saved-searches", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await DELETE(new Request("http://x?id=s1", { method: "DELETE" }))).status).toBe(401);
  });

  it("400 when the id query param is missing", async () => {
    setMock(authUser, () => ({}));
    expect((await DELETE(new Request("http://x", { method: "DELETE" }))).status).toBe(400);
  });

  it("deletes the search scoped to the user", async () => {
    const mock = setMock(authUser, () => ({ error: null }));
    const res = await DELETE(new Request("http://x?id=s1", { method: "DELETE" }));
    expect((await res.json()).deleted).toBe(true);
    const del = mock.calls.find((c) => c.table === "saved_searches" && c.verb === "delete");
    expect(del?.filters).toContainEqual({ method: "eq", args: ["user_id", USER_ID] });
  });
});
