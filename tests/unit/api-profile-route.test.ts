import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));

import { PUT } from "@/app/api/profile/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
function req(body: unknown) {
  return new Request("http://test/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PUT /api/profile", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await PUT(req({}))).status).toBe(401);
  });

  it("400 on an invalid username", async () => {
    setMock(authUser, () => ({}));
    // "ab" is shorter than the 3-char minimum -> schema refine fails.
    expect((await PUT(req({ username: "ab" }))).status).toBe(400);
  });

  it("404 when the profile row is missing", async () => {
    setMock(authUser, (t) => (t === "profiles" ? { data: null } : { error: null }));
    expect((await PUT(req({}))).status).toBe(404);
  });

  it("409 when the username is already taken", async () => {
    setMock(authUser, (t, v) => {
      if (t === "profiles" && v === "select") return { data: { id: "p1" } };
      if (t === "profiles" && v === "update") {
        return { error: { message: "duplicate key value violates unique constraint profiles_username_key" } };
      }
      return { error: null };
    });
    const res = await PUT(req({ username: "taken" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already taken/i);
  });

  it("updates the profile successfully", async () => {
    const mock = setMock(authUser, (t, v) => {
      if (t === "profiles" && v === "select") return { data: { id: "p1" } };
      return { error: null };
    });
    const res = await PUT(req({ name: "Ada", username: "ada_dev" }));
    expect(res.status).toBe(200);
    const update = mock.calls.find((c) => c.table === "profiles" && c.verb === "update");
    expect((update?.payload as { username: string }).username).toBe("ada_dev");
  });
});
