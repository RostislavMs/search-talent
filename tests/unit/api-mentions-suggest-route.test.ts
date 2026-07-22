import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));

import { GET } from "@/app/api/mentions/suggest/route";

const authUser: MockUser = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
const req = (q: string) => new Request(`http://test/api/mentions/suggest?q=${encodeURIComponent(q)}`);

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/mentions/suggest", () => {
  it("returns empty for anonymous callers", async () => {
    setMock(null);
    expect((await (await GET(req("ada"))).json()).suggestions).toEqual([]);
  });

  it("returns empty for a blank query", async () => {
    setMock(authUser);
    expect((await (await GET(req("  "))).json()).suggestions).toEqual([]);
  });

  it("maps matching profiles to suggestions", async () => {
    setMock(authUser, (t) =>
      t === "profiles"
        ? { data: [{ user_id: "u1", username: "ada", name: "Ada", avatar_url: null }] }
        : {},
    );
    const res = await GET(req("ad"));
    expect((await res.json()).suggestions).toEqual([
      { userId: "u1", username: "ada", name: "Ada", avatarUrl: null },
    ]);
  });

  it("drops rows without a username", async () => {
    setMock(authUser, (t) =>
      t === "profiles"
        ? { data: [{ user_id: "u1", username: null, name: "No Name", avatar_url: null }] }
        : {},
    );
    expect((await (await GET(req("no"))).json()).suggestions).toEqual([]);
  });

  it("returns empty on a query error", async () => {
    setMock(authUser, (t) => (t === "profiles" ? { error: { message: "boom" } } : {}));
    expect((await (await GET(req("ada"))).json()).suggestions).toEqual([]);
  });
});
