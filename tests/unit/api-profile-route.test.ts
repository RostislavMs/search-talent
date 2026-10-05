import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => `clean:${s}` }));

import { PUT } from "@/app/api/profile/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

type SavePayload = {
  profile: Record<string, unknown>;
  private: Record<string, unknown>;
  skills: number[];
  languages: unknown[];
  education: unknown[];
  certificates: unknown[];
  qas: unknown[];
  work_experience: Array<Record<string, unknown>>;
};

/** Everything goes to save_my_profile in one call; `answer` is its result. */
function setMock(user: MockUser, answer: QueryResult = { data: { profileId: "p1" } }) {
  const rpc = vi.fn<(fn: string, args?: unknown) => QueryResult>(() => answer);
  holder.mock = createSupabaseMock({ user, resolve: () => ({}), rpc });
  return {
    mock: holder.mock,
    rpc,
    sent: () => (rpc.mock.calls[0]?.[1] as { p: SavePayload } | undefined)?.p,
  };
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
    setMock(null);
    expect((await PUT(req({}))).status).toBe(401);
  });

  it("400 on an invalid username, before anything is written", async () => {
    const { rpc } = setMock(authUser);
    // "ab" is shorter than the 3-char minimum -> schema refine fails.
    expect((await PUT(req({ username: "ab" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("404 when the profile row is missing", async () => {
    setMock(authUser, { error: { code: "P0002", message: "profile not found" } });
    expect((await PUT(req({}))).status).toBe(404);
  });

  it("409 when the username is already taken", async () => {
    setMock(authUser, { error: { code: "23505", message: "username_taken" } });
    const res = await PUT(req({ username: "taken" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already taken/i);
  });

  it("a duplicate elsewhere is not a taken nick", async () => {
    setMock(authUser, { error: { code: "23505", message: 'duplicate key value violates unique constraint "profile_qas_pkey"' } });
    expect((await PUT(req({}))).status).toBe(400);
  });

  it("saves the whole profile in one database call", async () => {
    const { rpc, sent } = setMock(authUser);
    const res = await PUT(req({ name: "Ada", username: "ada_dev", bio: "<p>Hi</p>", skill_ids: [3, 4] }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][0]).toBe("save_my_profile");
    expect(sent()?.profile).toMatchObject({ name: "Ada", username: "ada_dev", bio: "clean:<p>Hi</p>" });
    expect(sent()?.skills).toEqual([3, 4]);
    // Every section is sent, so a removed row is removed.
    for (const key of ["languages", "education", "certificates", "qas", "work_experience"] as const) {
      expect(sent()?.[key]).toEqual([]);
    }
  });

  it("drops empty section rows and ends a current job", async () => {
    const { sent } = setMock(authUser);
    await PUT(
      req({
        languages: [{ id: "l1", language_id: null, proficiency_level: "native" }],
        work_experience: [
          { id: "w1", company_name: "Acme", is_current: true, started_year: 2020, ended_year: 2023 },
          { id: "w2", company_name: "", is_current: false },
        ],
      }),
    );
    expect(sent()?.languages).toEqual([]);
    expect(sent()?.work_experience).toEqual([
      expect.objectContaining({ id: "w1", ended_year: null, is_current: true }),
    ]);
  });

  it("keeps email, phone and salary out of the public profiles row", async () => {
    const { sent } = setMock(authUser);
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

    const publicRow = sent()!.profile;
    expect(publicRow.open_to).toEqual(["freelance", "mentoring"]);
    for (const key of ["contact_email", "phone", "salary_expectations", "salary_currency", "employment_types"]) {
      expect(publicRow).not.toHaveProperty(key);
    }

    expect(sent()?.private).toEqual({
      contact_email: "ada@example.com",
      phone: "+380501112233",
      salary_expectations: "3000",
      salary_currency: "usd",
      salary_public: true,
      hourly_rate: null,
      hourly_rate_currency: null,
      hourly_rate_public: false,
    });
  });

  it("stores the hourly rate in the owner-only part", async () => {
    const { sent } = setMock(authUser);
    const res = await PUT(req({ hourly_rate: 25, hourly_rate_currency: "eur", hourly_rate_public: true }));
    expect(res.status).toBe(200);

    for (const key of ["hourly_rate", "hourly_rate_currency", "hourly_rate_public"]) {
      expect(sent()!.profile).not.toHaveProperty(key);
    }
    expect(sent()?.private).toMatchObject({
      hourly_rate: 25,
      hourly_rate_currency: "eur",
      hourly_rate_public: true,
    });
  });

  it("cannot show an hourly rate that is not there", async () => {
    const { sent } = setMock(authUser);
    await PUT(req({ hourly_rate: "", hourly_rate_currency: "usd", hourly_rate_public: true }));
    expect(sent()?.private).toMatchObject({
      hourly_rate: null,
      hourly_rate_currency: null,
      hourly_rate_public: false,
    });
  });

  it("400 on an hourly rate out of range, before anything is written", async () => {
    const { rpc } = setMock(authUser);
    for (const hourly_rate of [0, 12.5, 100_001, "abc"]) {
      expect((await PUT(req({ hourly_rate }))).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cannot show a salary that is not there", async () => {
    const { sent } = setMock(authUser);
    await PUT(req({ salary_currency: "usd", salary_public: true }));
    expect(sent()?.private).toMatchObject({
      salary_expectations: null,
      salary_currency: null,
      salary_public: false,
    });
  });

  it("400 with the database message when the save fails", async () => {
    setMock(authUser, { error: { code: "23514", message: "invalid phone" } });
    const res = await PUT(req({ contact_email: "ada@example.com" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid phone");
  });
});
