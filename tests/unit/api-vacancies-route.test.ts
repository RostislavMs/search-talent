import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: {
    mock: null as SupabaseMock | null,
    isAdmin: false,
    resolve: (() => ({})) as (call: QueryCall) => QueryResult,
  },
}));

vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: vi.fn(async () => {
    const client = holder.mock!.client;
    const {
      data: { user },
    } = await client.auth.getUser();
    return { supabase: client, user, isAdmin: holder.isAdmin };
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/companies", () => ({ getCompanyRole: vi.fn(async () => null) }));
vi.mock("@/lib/db/vacancies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/vacancies")>();
  return {
    ...actual,
    // Stands in for save_vacancy: the row (with its skills, in the same
    // transaction) goes through the test's resolver as the insert or update
    // the database would run, and is recorded like any other query.
    saveVacancy: vi.fn(async (_supabase: unknown, id: string | null, row: Record<string, unknown>) => {
      const call: QueryCall = {
        table: "vacancies",
        verb: id ? "update" : "insert",
        filters: id ? [{ method: "eq", args: ["id", id] }] : [],
        modifiers: [],
        payload: row,
      };
      holder.mock!.calls.push(call);
      const result = holder.resolve(call);
      if (result.error) return { vacancy: null, error: result.error };
      if (!result.data) return { vacancy: null, error: { code: "P0002", message: "vacancy not found" } };
      return { vacancy: result.data, error: null };
    }),
  };
});

import { POST } from "@/app/api/vacancies/route";
import { DELETE, PATCH } from "@/app/api/vacancies/[id]/route";
import { getCompanyRole } from "@/lib/db/companies";
import { saveVacancy } from "@/lib/db/vacancies";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const VACANCY_ID = "33333333-3333-4333-8333-333333333333";
const confirmed: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const unconfirmed: MockUser = { id: USER_ID, email_confirmed_at: null };

const longText = "We are looking for a junior frontend developer to build interfaces with React and TypeScript.";

const vacancy = {
  title: "Junior frontend developer",
  description: `<p>${longText}</p>`,
  kind: "job",
  hours: "full_time",
  work_formats: ["remote"],
  country_id: null,
  city: "Kyiv",
  experience_level: "junior",
  category_id: null,
  pay: { min: 20_000, max: 30_000, currency: "uah", period: "month" },
  locale: "en",
  skill_ids: [1, 2],
  status: "published",
};

const createPayload = { ...vacancy, company_id: COMPANY_ID };

const SLUG_PATTERN = /^junior-frontend-developer-[0-9a-z]{6}$/;

function setMock(user: MockUser, resolve: (call: QueryCall) => QueryResult = () => ({})) {
  holder.resolve = resolve;
  holder.mock = createSupabaseMock({ user, resolve });
  return holder.mock;
}

/** The insert answers with the row the database would return. */
function created(moderationStatus = "approved", moderationNote: string | null = null) {
  return (call: QueryCall): QueryResult => {
    if (call.table === "vacancies" && call.verb === "insert") {
      const row = call.payload as { slug: string; status: string };
      return {
        data: {
          id: VACANCY_ID,
          slug: row.slug,
          status: row.status,
          moderation_status: moderationStatus,
          moderation_note: moderationNote,
        },
      };
    }
    return {};
  };
}

function req(method: string, body?: unknown) {
  return new Request("http://test/api/vacancies", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id = VACANCY_ID) => ({ params: Promise.resolve({ id }) });

const inserts = (mock: SupabaseMock) =>
  mock.calls.filter((call) => call.table === "vacancies" && call.verb === "insert");

beforeEach(() => {
  holder.isAdmin = false;
  vi.mocked(getCompanyRole).mockResolvedValue("recruiter");
});

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/vacancies — guards", () => {
  it("401 for guests", async () => {
    setMock(null);
    expect((await POST(req("POST", createPayload))).status).toBe(401);
  });

  it("403 with a code when the email is not confirmed", async () => {
    setMock(unconfirmed);
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("email_unconfirmed");
  });

  it("400 for an invalid payload", async () => {
    setMock(confirmed);
    const res = await POST(req("POST", { ...createPayload, title: "ab" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Title is too short", code: "invalid" });
  });

  it("400 without a company", async () => {
    setMock(confirmed);
    expect((await POST(req("POST", vacancy))).status).toBe(400);
  });

  it("403 for someone outside the team", async () => {
    const mock = setMock(confirmed, created());
    vi.mocked(getCompanyRole).mockResolvedValueOnce(null);
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
    expect(getCompanyRole).toHaveBeenCalledWith(mock.client, COMPANY_ID, USER_ID);
    expect(inserts(mock)).toHaveLength(0);
  });

  it("lets a platform admin post for any company", async () => {
    holder.isAdmin = true;
    setMock(confirmed, created());
    vi.mocked(getCompanyRole).mockResolvedValueOnce(null);
    expect((await POST(req("POST", createPayload))).status).toBe(201);
  });

  it("passes the rate limiter's answer through", async () => {
    const mock = setMock(confirmed, created());
    const { NextResponse } = await import("next/server");
    vi.mocked(dbRateLimit).mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    expect((await POST(req("POST", createPayload))).status).toBe(429);
    expect(dbRateLimit).toHaveBeenCalledWith(`create-vacancy:${USER_ID}`, 10, 60 * 60_000);
    expect(inserts(mock)).toHaveLength(0);
  });
});

describe("POST /api/vacancies — readiness", () => {
  it("does not publish a vacancy with too little text", async () => {
    const mock = setMock(confirmed, created());
    const res = await POST(req("POST", { ...createPayload, description: "<p>Short.</p>" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "description_short", issues: ["description_short"] });
    expect(inserts(mock)).toHaveLength(0);
  });

  it("does not publish a job without pay", async () => {
    setMock(confirmed, created());
    const res = await POST(req("POST", { ...createPayload, pay: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "pay_required", issues: ["pay_required"] });
  });

  it("names the first issue and lists them all", async () => {
    setMock(confirmed, created());
    const res = await POST(req("POST", { ...createPayload, description: "", pay: null }));
    expect(await res.json()).toMatchObject({
      code: "description_short",
      issues: ["description_short", "pay_required"],
    });
  });

  it("saves an unfinished draft", async () => {
    const mock = setMock(confirmed, created());
    const res = await POST(req("POST", { ...createPayload, description: "", pay: null, status: "draft" }));
    expect(res.status).toBe(201);
    expect(inserts(mock)[0].payload).toMatchObject({ status: "draft", description: "", pay_min: null });
  });

  it("lets freelance go out without pay", async () => {
    setMock(confirmed, created());
    const res = await POST(req("POST", { ...createPayload, kind: "freelance", pay: null }));
    expect(res.status).toBe(201);
  });
});

describe("POST /api/vacancies — creation", () => {
  it("writes the vacancy with the caller as author and a fresh address", async () => {
    const mock = setMock(confirmed, created());
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toEqual({
      vacancy: { id: VACANCY_ID, slug: expect.stringMatching(SLUG_PATTERN) },
      heldForReview: false,
      moderationStatus: "approved",
    });

    const [insert] = inserts(mock);
    expect(insert.payload).toMatchObject({
      title: "Junior frontend developer",
      kind: "job",
      hours: "full_time",
      work_formats: ["remote"],
      city: "Kyiv",
      experience_level: "junior",
      pay_min: 20_000,
      pay_max: 30_000,
      pay_currency: "uah",
      pay_period: "month",
      locale: "en",
      company_id: COMPANY_ID,
      status: "published",
      slug: body.vacancy.slug,
    });
    // The database makes the caller the author.
    expect(insert.payload).not.toHaveProperty("author_user_id");
    expect((insert.payload as { description: string }).description).toContain(longText);
    expect(saveVacancy).toHaveBeenCalledWith(mock.client, null, expect.anything(), [1, 2]);
  });

  it("does not let the form set what the database owns", async () => {
    const mock = setMock(confirmed, created());
    await POST(
      req("POST", {
        ...createPayload,
        slug: "my-own-address",
        author_user_id: "99999999-9999-4999-8999-999999999999",
        moderation_status: "approved",
        published_at: "2020-01-01T00:00:00Z",
        expires_at: "2099-01-01T00:00:00Z",
        closed_at: null,
      }),
    );
    const payload = inserts(mock)[0].payload as Record<string, unknown>;
    expect(payload.slug).toMatch(SLUG_PATTERN);
    for (const key of ["author_user_id", "moderation_status", "published_at", "expires_at", "closed_at", "skill_ids", "moderated_by"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("sanitizes the description", async () => {
    const mock = setMock(confirmed, created());
    await POST(
      req("POST", {
        ...createPayload,
        description: `<p>${longText}</p><script>alert(1)</script><img src=x onerror="alert(2)">`,
      }),
    );
    const description = (inserts(mock)[0].payload as { description: string }).description;
    expect(description).toContain(longText);
    expect(description).not.toMatch(/<script|onerror/i);
  });

  it("rolls another address when the first one is taken", async () => {
    let attempt = 0;
    const mock = setMock(confirmed, (call) => {
      if (call.table === "vacancies" && call.verb === "insert") {
        attempt += 1;
        if (attempt === 1) return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        return created()(call);
      }
      return {};
    });
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(201);

    const [first, second] = inserts(mock).map((call) => (call.payload as { slug: string }).slug);
    expect(inserts(mock)).toHaveLength(2);
    expect(first).toMatch(SLUG_PATTERN);
    expect(second).toMatch(SLUG_PATTERN);
    expect(second).not.toBe(first);
    expect((await res.json()).vacancy.slug).toBe(second);
  });

  it("gives up after the second clash", async () => {
    const mock = setMock(confirmed, () => ({ error: { code: "23505", message: "duplicate key" } }));
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid");
    expect(inserts(mock)).toHaveLength(2);
  });

  it.each([
    [{ code: "P0001", message: "vacancy_daily_limit_reached" }, 409, "daily_limit"],
    [{ code: "P0001", message: "invalid_vacancy_status" }, 409, "invalid_status"],
    [{ code: "42501", message: "new row violates row-level security policy" }, 403, "forbidden"],
    [{ code: "23514", message: 'violates check constraint "vacancies_pay_required_check"' }, 400, "pay_required"],
    [{ code: "23514", message: "check constraint" }, 400, "invalid"],
  ])("maps a database error %o to %i %s", async (error, status, code) => {
    const mock = setMock(confirmed, () => ({ error }));
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: error.message, code });
    expect(inserts(mock)).toHaveLength(1);
  });

  it("leaves nothing behind when the skills could not be saved", async () => {
    // One transaction: the database drops the vacancy with its skills, so the
    // route has nothing to take back.
    const mock = setMock(confirmed, () => ({ error: { code: "P0001", message: "vacancy_skills_limit_reached" } }));
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("skills_limit");
    expect(mock.calls.some((call) => call.verb === "delete")).toBe(false);
  });

  it("reports what the database decided about moderation", async () => {
    setMock(confirmed, created("under_review"));
    const res = await POST(req("POST", createPayload));
    expect(await res.json()).toMatchObject({ heldForReview: false, moderationStatus: "under_review" });
  });
});

describe("POST /api/vacancies — auto-moderation", () => {
  // The database screens the text (moderation_screen, scam phrases included);
  // the route only tells its hold from the unverified company's wait.
  it("says when auto-moderation held the vacancy", async () => {
    setMock(confirmed, created("under_review", "[авто] Виявлено: ознаки шахрайства"));
    const res = await POST(req("POST", createPayload));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ heldForReview: true, moderationStatus: "under_review" });
  });

  it("does not call a moderator's other note a hold", async () => {
    setMock(confirmed, created("under_review", "Moved to review automatically after an urgent community report."));
    expect(await (await POST(req("POST", createPayload))).json()).toMatchObject({ heldForReview: false });
  });
});

describe("PATCH /api/vacancies/:id", () => {
  function editing(
    existingStatus: string,
    saved: Partial<{ status: string; moderation_status: string; moderation_note: string | null }> = {},
    updateResult?: QueryResult,
  ) {
    return setMock(confirmed, (call) => {
      if (call.table !== "vacancies") return {};
      if (call.verb === "select") return { data: { id: VACANCY_ID, company_id: COMPANY_ID, status: existingStatus } };
      if (call.verb === "update") {
        if (updateResult) return updateResult;
        const payload = call.payload as { status?: string };
        return {
          data: {
            id: VACANCY_ID,
            slug: "junior-frontend-developer-abc123",
            status: saved.status ?? payload.status ?? existingStatus,
            moderation_status: saved.moderation_status ?? "approved",
            moderation_note: saved.moderation_note ?? null,
          },
        };
      }
      return {};
    });
  }

  const updateOf = (mock: SupabaseMock) =>
    mock.calls.find((call) => call.table === "vacancies" && call.verb === "update");

  it("400 for a bad id", async () => {
    setMock(confirmed);
    expect((await PATCH(req("PATCH", vacancy), params("nope"))).status).toBe(400);
  });

  it("401 for guests", async () => {
    setMock(null);
    expect((await PATCH(req("PATCH", vacancy), params())).status).toBe(401);
  });

  it("404 when the vacancy is not there", async () => {
    setMock(confirmed, () => ({ data: null }));
    expect((await PATCH(req("PATCH", vacancy), params())).status).toBe(404);
  });

  it("403 for someone outside the team", async () => {
    const mock = editing("published");
    vi.mocked(getCompanyRole).mockResolvedValueOnce(null);
    const res = await PATCH(req("PATCH", vacancy), params());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
    expect(getCompanyRole).toHaveBeenCalledWith(mock.client, COMPANY_ID, USER_ID);
    expect(updateOf(mock)).toBeUndefined();
  });

  it("lets a platform admin edit", async () => {
    holder.isAdmin = true;
    editing("published");
    vi.mocked(getCompanyRole).mockResolvedValueOnce(null);
    expect((await PATCH(req("PATCH", vacancy), params())).status).toBe(200);
  });

  it("400 for an invalid payload", async () => {
    editing("published");
    const res = await PATCH(req("PATCH", { ...vacancy, kind: "mentoring" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid");
  });

  it("keeps the status of a vacancy that is already out", async () => {
    const mock = editing("published");
    const res = await PATCH(req("PATCH", { ...vacancy, status: "draft", title: "Middle frontend developer" }), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      vacancy: { id: VACANCY_ID, slug: "junior-frontend-developer-abc123", status: "published" },
      heldForReview: false,
      moderationStatus: "approved",
    });

    const update = updateOf(mock)!;
    expect(update.payload).toMatchObject({ title: "Middle frontend developer", pay_min: 20_000 });
    expect(update.payload).not.toHaveProperty("status");
    expect(update.payload).not.toHaveProperty("slug");
    expect(update.payload).not.toHaveProperty("expires_at");
    expect(update.filters).toEqual([{ method: "eq", args: ["id", VACANCY_ID] }]);
    expect(saveVacancy).toHaveBeenCalledWith(mock.client, VACANCY_ID, expect.anything(), [1, 2]);
  });

  it.each(["published", "closed", "expired"])(
    "keeps a %s vacancy complete, even when the form asks for a draft",
    async (status) => {
      const mock = editing(status);
      const res = await PATCH(req("PATCH", { ...vacancy, status: "draft", pay: null }), params());
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("pay_required");
      expect(updateOf(mock)).toBeUndefined();
    },
  );

  it("publishes a draft with the same save", async () => {
    const mock = editing("draft");
    const res = await PATCH(req("PATCH", { ...vacancy, status: "published" }), params());
    expect(res.status).toBe(200);
    expect(updateOf(mock)?.payload).toMatchObject({ status: "published" });
    expect((await res.json()).vacancy.status).toBe("published");
  });

  it("checks a draft that goes out", async () => {
    const mock = editing("draft");
    const res = await PATCH(req("PATCH", { ...vacancy, description: "<p>Too short</p>" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("description_short");
    expect(updateOf(mock)).toBeUndefined();
  });

  it("saves an unfinished draft as a draft, without screening it", async () => {
    const mock = editing("draft");
    const res = await PATCH(
      req("PATCH", { ...vacancy, status: "draft", pay: null, description: "<p>Внесіть депозит</p>" }),
      params(),
    );
    expect(res.status).toBe(200);
    expect(updateOf(mock)?.payload).toMatchObject({ status: "draft", pay_min: null });
  });

  it("says when the database held the edited text", async () => {
    editing("published", { moderation_status: "under_review", moderation_note: "[авто] Виявлено: ознаки шахрайства" });
    const res = await PATCH(req("PATCH", vacancy), params());
    expect(await res.json()).toMatchObject({ heldForReview: true, moderationStatus: "under_review" });
  });

  it("passes a moderator's stricter decision through", async () => {
    editing("published", { moderation_status: "restricted", moderation_note: "fake" });
    const res = await PATCH(req("PATCH", vacancy), params());
    expect(await res.json()).toMatchObject({ heldForReview: false, moderationStatus: "restricted" });
  });

  it.each([
    [{ code: "42501", message: "row-level security" }, 403, "forbidden"],
    [{ code: "P0001", message: "invalid_vacancy_status" }, 409, "invalid_status"],
    [{ code: "P0001", message: "vacancy_daily_limit_reached" }, 409, "daily_limit"],
  ])("maps a database error %o to %i %s", async (error, status, code) => {
    editing("published", {}, { error });
    const res = await PATCH(req("PATCH", vacancy), params());
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });

  it("404 when the update matched nothing", async () => {
    editing("published", {}, { data: null });
    expect((await PATCH(req("PATCH", vacancy), params())).status).toBe(404);
  });

  it("reports a failed skills save", async () => {
    const mock = editing("published", {}, { error: { code: "P0001", message: "vacancy_skills_limit_reached" } });
    const res = await PATCH(req("PATCH", vacancy), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("skills_limit");
    expect(mock.calls.some((call) => call.verb === "delete")).toBe(false);
  });
});

describe("DELETE /api/vacancies/:id", () => {
  it("400 for a bad id", async () => {
    setMock(confirmed);
    expect((await DELETE(req("DELETE"), params("nope"))).status).toBe(400);
  });

  it("401 for guests", async () => {
    setMock(null);
    expect((await DELETE(req("DELETE"), params())).status).toBe(401);
  });

  it("404 when nothing was deleted (not allowed or gone)", async () => {
    setMock(confirmed, () => ({ data: [] }));
    const res = await DELETE(req("DELETE"), params());
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
  });

  it("400 on a database error", async () => {
    setMock(confirmed, () => ({ error: { message: "fk violation" } }));
    const res = await DELETE(req("DELETE"), params());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("fk violation");
  });

  it("deletes the vacancy and lets RLS decide who may", async () => {
    const mock = setMock(confirmed, () => ({ data: [{ id: VACANCY_ID }] }));
    const res = await DELETE(req("DELETE"), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    const call = mock.calls[0];
    expect(call).toMatchObject({ table: "vacancies", verb: "delete" });
    expect(call.filters).toEqual([{ method: "eq", args: ["id", VACANCY_ID] }]);
    expect(getCompanyRole).not.toHaveBeenCalled();
  });
});
