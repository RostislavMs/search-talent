import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null, admin: null as SupabaseMock | null },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => holder.admin?.client ?? null) }));
vi.mock("@/lib/rate-limit", () => ({
  dbRateLimit: vi.fn(async () => null),
  rateLimit: vi.fn(() => null),
}));

import { POST } from "@/app/api/job-alerts/route";
import { DELETE, PATCH } from "@/app/api/job-alerts/[id]/route";
import { POST as UNSUBSCRIBE } from "@/app/api/job-alerts/unsubscribe/route";
import { jobAlertUnsubscribeToken } from "@/lib/job-alert-token";
import { dbRateLimit, rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ALERT_ID = "22222222-2222-4222-8222-222222222222";
const signedIn: MockUser = { id: USER_ID };

const ROW = {
  id: ALERT_ID,
  user_id: USER_ID,
  name: "Стажування · Віддалено",
  params: { kind: "internship", format: "remote" },
  notify_email: true,
  created_at: "2026-10-03T10:00:00Z",
};

function setMock(user: MockUser, resolve: (call: QueryCall) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve });
}

function json(url: string, method: string, body?: unknown) {
  return new Request(`http://test${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const inserts = () => holder.mock!.calls.filter((call) => call.verb === "insert");

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-secret");
});

afterEach(() => {
  holder.mock = null;
  holder.admin = null;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/job-alerts", () => {
  it("401 for a guest", async () => {
    setMock(null);
    const res = await POST(json("/api/job-alerts", "POST", { filters: {} }));
    expect(res.status).toBe(401);
    expect(inserts()).toHaveLength(0);
  });

  it("is rate limited per person", async () => {
    setMock(signedIn);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(new Response("slow down", { status: 429 }) as never);
    const res = await POST(json("/api/job-alerts", "POST", { filters: {} }));
    expect(res.status).toBe(429);
    expect(dbRateLimit).toHaveBeenCalledWith(`job-alerts:${USER_ID}`, 30, 3_600_000);
  });

  it.each([
    ["no body", undefined],
    ["both kinds at once", { match: "profile", filters: {} }],
    ["an unknown match", { match: "everything" }],
    ["a non-string filter", { filters: { kind: 1 } }],
    ["an extra field", { filters: {}, notify: true }],
    ["too many filters", { filters: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, "x"])) }],
  ])("400 for %s", async (_label, body) => {
    setMock(signedIn);
    const res = await POST(json("/api/job-alerts", "POST", body));
    expect(res.status).toBe(400);
    expect(inserts()).toHaveLength(0);
  });

  it("follows the filters, named in the person's language, email on by default", async () => {
    setMock(signedIn, (call) => {
      if (call.table === "countries") return { data: { name: "Україна" } };
      if (call.table === "saved_searches") return { data: ROW };
      return {};
    });
    const res = await POST(
      json("/api/job-alerts", "POST", {
        filters: { kind: "internship", format: "remote", country: "1", page: "3", junk: "x" },
        locale: "uk",
      }),
    );

    expect(res.status).toBe(201);
    expect((await res.json()).alert).toMatchObject({
      id: ALERT_ID,
      notifyEmail: true,
      href: "/jobs?kind=internship&format=remote",
      target: { type: "filters" },
    });
    const [insert] = inserts();
    expect(insert.table).toBe("saved_searches");
    expect(insert.payload).toEqual({
      user_id: USER_ID,
      name: "Стажування · Віддалено · Україна",
      mode: "vacancies",
      params: { kind: "internship", format: "remote", country: "1" },
      notify_email: true,
    });
  });

  it("switches on «fits me» without email when asked, named in Ukrainian by default", async () => {
    setMock(signedIn, () => ({ data: { ...ROW, params: { match: "profile" }, notify_email: false } }));
    const res = await POST(json("/api/job-alerts", "POST", { match: "profile", notifyEmail: false }));

    expect(res.status).toBe(201);
    expect(inserts()[0].payload).toMatchObject({
      name: "Вакансії, що мені підходять",
      params: { match: "profile" },
      notify_email: false,
    });
    expect((await res.json()).alert.href).toBe("/my-space/job-alerts");
  });

  it.each([
    [{ code: "23505", message: "duplicate key value violates saved_searches_vacancies_unique" }, 409, "duplicate"],
    [{ code: "P0001", message: "job_alert_limit_reached" }, 409, "limit"],
    [{ code: "23514", message: "violates check constraint" }, 400, "invalid"],
    [{ code: "PGRST204", message: "Could not find the 'notify_email' column" }, 503, "unavailable"],
    [{ code: "23514", message: "violates check constraint saved_searches_mode_check" }, 503, "unavailable"],
  ])("maps %o to %i", async (error, status, code) => {
    setMock(signedIn, (call) => (call.table === "saved_searches" ? { error } : {}));
    const res = await POST(json("/api/job-alerts", "POST", { filters: { kind: "job" } }));

    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });
});

describe("PATCH /api/job-alerts/:id", () => {
  it("400 for a bad id or body, 401 for a guest", async () => {
    setMock(signedIn);
    expect((await PATCH(json("/api/job-alerts/x", "PATCH", { notifyEmail: true }), params("x"))).status).toBe(400);
    expect((await PATCH(json(`/api/job-alerts/${ALERT_ID}`, "PATCH", { notifyEmail: "yes" }), params(ALERT_ID))).status).toBe(400);
    expect((await PATCH(json(`/api/job-alerts/${ALERT_ID}`, "PATCH", { notifyEmail: true, name: "x" }), params(ALERT_ID))).status).toBe(400);

    setMock(null);
    expect((await PATCH(json(`/api/job-alerts/${ALERT_ID}`, "PATCH", { notifyEmail: true }), params(ALERT_ID))).status).toBe(401);
  });

  it("switches the email for the person's own alert only", async () => {
    setMock(signedIn, () => ({ data: [{ id: ALERT_ID }] }));
    const res = await PATCH(json(`/api/job-alerts/${ALERT_ID}`, "PATCH", { notifyEmail: false }), params(ALERT_ID));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alert: { id: ALERT_ID, notifyEmail: false } });
    const [update] = holder.mock!.calls;
    expect(update.verb).toBe("update");
    expect(update.payload).toEqual({ notify_email: false });
    expect(update.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["id", ALERT_ID] },
        { method: "eq", args: ["user_id", USER_ID] },
        { method: "eq", args: ["mode", "vacancies"] },
      ]),
    );
  });

  it("404 when nothing matched", async () => {
    setMock(signedIn, () => ({ data: [] }));
    expect((await PATCH(json(`/api/job-alerts/${ALERT_ID}`, "PATCH", { notifyEmail: true }), params(ALERT_ID))).status).toBe(404);
    setMock(signedIn, () => ({ error: { message: "boom" } }));
    expect((await PATCH(json(`/api/job-alerts/${ALERT_ID}`, "PATCH", { notifyEmail: true }), params(ALERT_ID))).status).toBe(404);
  });
});

describe("DELETE /api/job-alerts/:id", () => {
  it("400, 401 and 404 as expected", async () => {
    setMock(signedIn);
    expect((await DELETE(json("/api/job-alerts/x", "DELETE"), params("x"))).status).toBe(400);
    setMock(null);
    expect((await DELETE(json(`/api/job-alerts/${ALERT_ID}`, "DELETE"), params(ALERT_ID))).status).toBe(401);
    setMock(signedIn, () => ({ data: [] }));
    expect((await DELETE(json(`/api/job-alerts/${ALERT_ID}`, "DELETE"), params(ALERT_ID))).status).toBe(404);
  });

  it("removes the person's own alert", async () => {
    setMock(signedIn, () => ({ data: [{ id: ALERT_ID }] }));
    const res = await DELETE(json(`/api/job-alerts/${ALERT_ID}`, "DELETE"), params(ALERT_ID));

    expect(res.status).toBe(200);
    expect(holder.mock!.calls[0].verb).toBe("delete");
    expect(holder.mock!.calls[0].filters).toEqual(
      expect.arrayContaining([{ method: "eq", args: ["user_id", USER_ID] }]),
    );
  });
});

describe("POST /api/job-alerts/unsubscribe", () => {
  function setAdmin(resolve: (call: QueryCall) => QueryResult = () => ({})) {
    holder.admin = createSupabaseMock({ resolve });
  }

  it("turns the emails off from the one-click address (RFC 8058)", async () => {
    setAdmin();
    const token = jobAlertUnsubscribeToken(USER_ID)!;
    const res = await UNSUBSCRIBE(
      new Request(`http://test/api/job-alerts/unsubscribe?u=${USER_ID}&t=${token}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );

    expect(res.status).toBe(200);
    const [update] = holder.admin!.calls;
    expect(update.verb).toBe("update");
    expect(update.payload).toEqual({ notify_email: false });
    expect(update.filters).toEqual([
      { method: "eq", args: ["user_id", USER_ID] },
      { method: "eq", args: ["mode", "vacancies"] },
    ]);
    expect(rateLimit).toHaveBeenCalledWith(`job-alerts-unsubscribe:${USER_ID}`, 10, 60_000);
  });

  it("takes the link's values as JSON from the page", async () => {
    setAdmin();
    const res = await UNSUBSCRIBE(
      json("/api/job-alerts/unsubscribe", "POST", { u: USER_ID, t: jobAlertUnsubscribeToken(USER_ID) }),
    );
    expect(res.status).toBe(200);
  });

  it.each([
    ["nothing", {}],
    ["a forged token", { u: USER_ID, t: "a".repeat(64) }],
    ["someone else's token", { u: ALERT_ID, t: "TOKEN" }],
    ["a malformed id", { u: "me", t: "a".repeat(64) }],
  ])("400 for %s, nothing changed", async (_label, body) => {
    setAdmin();
    const payload = { ...body } as Record<string, string>;
    if (payload.t === "TOKEN") payload.t = jobAlertUnsubscribeToken(USER_ID)!;
    const res = await UNSUBSCRIBE(json("/api/job-alerts/unsubscribe", "POST", payload));

    expect(res.status).toBe(400);
    expect(holder.admin!.calls).toHaveLength(0);
  });

  it("400 for a body that is not JSON and no address values", async () => {
    setAdmin();
    const res = await UNSUBSCRIBE(json("/api/job-alerts/unsubscribe", "POST", "List-Unsubscribe=One-Click"));
    expect(res.status).toBe(400);
  });

  it("503 when the database cannot be reached", async () => {
    const token = jobAlertUnsubscribeToken(USER_ID)!;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    setAdmin(() => ({ error: { message: "down" } }));
    expect((await UNSUBSCRIBE(json("/api/job-alerts/unsubscribe", "POST", { u: USER_ID, t: token }))).status).toBe(503);

    holder.admin = null;
    expect((await UNSUBSCRIBE(json("/api/job-alerts/unsubscribe", "POST", { u: USER_ID, t: token }))).status).toBe(503);
    spy.mockRestore();
  });

  it("is rate limited per person", async () => {
    setAdmin();
    vi.mocked(rateLimit).mockReturnValueOnce(new Response("slow", { status: 429 }) as never);
    const res = await UNSUBSCRIBE(
      json("/api/job-alerts/unsubscribe", "POST", { u: USER_ID, t: jobAlertUnsubscribeToken(USER_ID) }),
    );
    expect(res.status).toBe(429);
    expect(holder.admin!.calls).toHaveLength(0);
  });
});
