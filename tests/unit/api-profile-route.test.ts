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

  it("keeps email, phone and salary out of the public profiles row", async () => {
    const mock = setMock(authUser, (t, v) => {
      if (t === "profiles" && v === "select") return { data: { id: "p1" } };
      return { error: null };
    });
    const res = await PUT(
      req({
        contact_email: "ada@example.com",
        phone: "+380501112233",
        salary_expectations: "3000",
        salary_currency: "usd",
        salary_public: true,
        open_to: ["mentoring", "freelance"],
      }),
    );
    expect(res.status).toBe(200);

    const update = mock.calls.find((c) => c.table === "profiles" && c.verb === "update");
    const publicRow = update?.payload as Record<string, unknown>;
    expect(publicRow.open_to).toEqual(["freelance", "mentoring"]);
    for (const key of ["contact_email", "phone", "salary_expectations", "salary_currency", "employment_types"]) {
      expect(publicRow).not.toHaveProperty(key);
    }

    const upsert = mock.calls.find((c) => c.table === "profile_private_details" && c.verb === "upsert");
    expect(upsert?.payload).toEqual({
      user_id: USER_ID,
      contact_email: "ada@example.com",
      phone: "+380501112233",
      salary_expectations: "3000",
      salary_currency: "usd",
      salary_public: true,
    });
  });

  it("cannot show a salary that is not there", async () => {
    const mock = setMock(authUser, (t, v) => {
      if (t === "profiles" && v === "select") return { data: { id: "p1" } };
      return { error: null };
    });
    await PUT(req({ salary_currency: "usd", salary_public: true }));

    const upsert = mock.calls.find((c) => c.table === "profile_private_details");
    expect(upsert?.payload).toMatchObject({
      salary_expectations: null,
      salary_currency: null,
      salary_public: false,
    });
  });

  it("400 when the private details cannot be saved", async () => {
    setMock(authUser, (t, v) => {
      if (t === "profiles" && v === "select") return { data: { id: "p1" } };
      if (t === "profile_private_details") return { error: { message: "denied" } };
      return { error: null };
    });
    expect((await PUT(req({ contact_email: "ada@example.com" }))).status).toBe(400);
  });
});
