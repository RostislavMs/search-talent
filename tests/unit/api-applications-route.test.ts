import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null, rpcCalls: [] as Array<{ fn: string; args: unknown }> },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/db/applications", () => ({
  notifyApplicationReceived: vi.fn(async () => undefined),
  notifyApplicationStatus: vi.fn(async () => undefined),
  notifyApplicationsViewed: vi.fn(async () => undefined),
}));

import { POST as APPLY } from "@/app/api/vacancies/[id]/applications/route";
import { POST as VIEWED } from "@/app/api/applications/viewed/route";
import { PATCH } from "@/app/api/applications/[id]/route";
import { POST as WITHDRAW } from "@/app/api/applications/[id]/withdraw/route";
import {
  notifyApplicationReceived,
  notifyApplicationStatus,
  notifyApplicationsViewed,
} from "@/lib/db/applications";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VACANCY_ID = "22222222-2222-4222-8222-222222222222";
const APPLICATION_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const APPLICANT_ID = "55555555-5555-4555-8555-555555555555";
const signedIn: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, rpc: (fn: string, args: unknown) => QueryResult = () => ({})) {
  holder.rpcCalls = [];
  holder.mock = createSupabaseMock({
    user,
    resolve: () => ({}),
    rpc: (fn, args) => {
      holder.rpcCalls.push({ fn, args });
      return rpc(fn, args);
    },
  });
}

function json(url: string, method: string, body?: unknown) {
  return new Request(`http://test${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const applyBody = { project_ids: [PROJECT_ID], message: " Hello ", consent: true };

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/vacancies/:id/applications", () => {
  const apply = (body: unknown = applyBody, id = VACANCY_ID) =>
    APPLY(json(`/api/vacancies/${id}/applications`, "POST", body), params(id));

  it("400 for a bad vacancy id", async () => {
    setMock(signedIn);
    expect((await apply(applyBody, "nope")).status).toBe(400);
  });

  it("401 for a guest", async () => {
    setMock(null);
    const res = await apply();
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("unauthorized");
    expect(holder.rpcCalls).toHaveLength(0);
  });

  it("400 without consent or projects, before asking the database", async () => {
    setMock(signedIn);
    expect((await apply({ project_ids: [PROJECT_ID] })).status).toBe(400);
    expect((await apply({ project_ids: [], consent: true })).status).toBe(400);
    expect((await apply("{not json")).status).toBe(400);
    expect(holder.rpcCalls).toHaveLength(0);
  });

  it("applies through apply_to_vacancy with the trimmed message, then tells the team", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", application_id: APPLICATION_ID, company_id: "c" } }));
    const res = await apply();

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ application: { id: APPLICATION_ID } });
    expect(holder.rpcCalls).toEqual([
      {
        fn: "apply_to_vacancy",
        args: { p_vacancy_id: VACANCY_ID, p_message: "Hello", p_project_ids: [PROJECT_ID] },
      },
    ]);
    expect(notifyApplicationReceived).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      vacancyId: VACANCY_ID,
      applicantUserId: USER_ID,
    });
  });

  it.each([
    ["email_unconfirmed", 403],
    ["not_open", 409],
    ["own_company", 403],
    ["no_profile", 403],
    ["message_long", 400],
    ["invalid_projects", 400],
    ["already_applied", 409],
    ["daily_limit", 429],
    ["something_new", 409],
  ])("passes the refusal %s on as %i, without notifying", async (status, http) => {
    setMock(signedIn, () => ({ data: { status } }));
    const res = await apply();
    expect(res.status).toBe(http);
    expect((await res.json()).code).toBe(status === "something_new" ? "not_open" : status);
    expect(notifyApplicationReceived).not.toHaveBeenCalled();
  });

  it("500 when the database call fails (e.g. before the migration)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setMock(signedIn, () => ({ error: { message: "function apply_to_vacancy does not exist" } }));
    const res = await apply();
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("failed");
  });
});

describe("POST /api/applications/viewed", () => {
  const viewed = (body: unknown) => VIEWED(json("/api/applications/viewed", "POST", body));

  it("401 for a guest", async () => {
    setMock(null);
    expect((await viewed({ ids: [APPLICATION_ID] })).status).toBe(401);
  });

  it("400 without ids", async () => {
    setMock(signedIn);
    expect((await viewed({ ids: [] })).status).toBe(400);
    expect(holder.rpcCalls).toHaveLength(0);
  });

  it("marks them and tells exactly the candidates whose applications changed", async () => {
    const rows = [{ application_id: APPLICATION_ID, applicant_user_id: APPLICANT_ID, vacancy_id: VACANCY_ID }];
    setMock(signedIn, () => ({ data: rows }));
    const res = await viewed({ ids: [APPLICATION_ID, APPLICATION_ID] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ viewed: 1 });
    expect(holder.rpcCalls).toEqual([
      { fn: "mark_vacancy_applications_viewed", args: { p_application_ids: [APPLICATION_ID] } },
    ]);
    expect(notifyApplicationsViewed).toHaveBeenCalledWith(rows);
  });

  it("500 when the database call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setMock(signedIn, () => ({ error: { message: "boom" } }));
    expect((await viewed({ ids: [APPLICATION_ID] })).status).toBe(500);
    expect(notifyApplicationsViewed).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/applications/:id", () => {
  const patch = (body: unknown, id = APPLICATION_ID) =>
    PATCH(json(`/api/applications/${id}`, "PATCH", body), params(id));

  const ok = (previous: string, changed = true) => () => ({
    data: {
      status: "ok",
      changed,
      previous_status: previous,
      applicant_user_id: APPLICANT_ID,
      vacancy_id: VACANCY_ID,
    },
  });

  it("400 for a bad id or a status the team cannot set", async () => {
    setMock(signedIn);
    expect((await patch({ status: "hired" }, "x")).status).toBe(400);
    expect((await patch({ status: "new" })).status).toBe(400);
    expect((await patch({ status: "withdrawn" })).status).toBe(400);
    expect(holder.rpcCalls).toHaveLength(0);
  });

  it("401 for a guest", async () => {
    setMock(null);
    expect((await patch({ status: "hired" })).status).toBe(401);
  });

  it("shortlists and tells the candidate", async () => {
    setMock(signedIn, ok("viewed"));
    const res = await patch({ status: "shortlisted" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ application: { id: APPLICATION_ID, status: "shortlisted" }, changed: true });
    expect(holder.rpcCalls).toEqual([
      { fn: "set_vacancy_application_status", args: { p_application_id: APPLICATION_ID, p_status: "shortlisted" } },
    ]);
    expect(notifyApplicationStatus).toHaveBeenCalledWith({
      applicationId: APPLICATION_ID,
      vacancyId: VACANCY_ID,
      applicantUserId: APPLICANT_ID,
      notice: "shortlisted",
    });
  });

  it("limits how often one application changes", async () => {
    setMock(signedIn, ok("viewed"));
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }) as never,
    );
    const res = await patch({ status: "shortlisted" });
    expect(res.status).toBe(429);
    expect(dbRateLimit).toHaveBeenCalledWith(`application-status:${APPLICATION_ID}`, 10, 3_600_000);
    expect(holder.rpcCalls).toHaveLength(0);
    expect(notifyApplicationStatus).not.toHaveBeenCalled();
  });

  it("tells about a rejection straight from new", async () => {
    setMock(signedIn, ok("new"));
    await patch({ status: "rejected" });
    expect(notifyApplicationStatus).toHaveBeenCalledWith(expect.objectContaining({ notice: "rejected" }));
  });

  it("stays silent when a decision is taken back or nothing changed", async () => {
    setMock(signedIn, ok("shortlisted"));
    expect((await patch({ status: "viewed" })).status).toBe(200);

    setMock(signedIn, ok("hired", false));
    const res = await patch({ status: "hired" });
    expect((await res.json()).changed).toBe(false);

    expect(notifyApplicationStatus).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404],
    ["withdrawn", 409],
    ["invalid_status", 400],
    ["unauthorized", 401],
    ["mystery", 404],
  ])("passes %s on as %i", async (status, http) => {
    setMock(signedIn, () => ({ data: { status } }));
    const res = await patch({ status: "hired" });
    expect(res.status).toBe(http);
    expect(notifyApplicationStatus).not.toHaveBeenCalled();
  });

  it("500 when the database call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setMock(signedIn, () => ({ error: { message: "boom" } }));
    expect((await patch({ status: "hired" })).status).toBe(500);
  });
});

describe("POST /api/applications/:id/withdraw", () => {
  const withdraw = (id = APPLICATION_ID) =>
    WITHDRAW(json(`/api/applications/${id}/withdraw`, "POST"), params(id));

  it("400 for a bad id, 401 for a guest", async () => {
    setMock(signedIn);
    expect((await withdraw("x")).status).toBe(400);
    setMock(null);
    expect((await withdraw()).status).toBe(401);
  });

  it("withdraws through withdraw_vacancy_application", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", vacancy_id: VACANCY_ID } }));
    const res = await withdraw();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ application: { id: APPLICATION_ID, status: "withdrawn" } });
    expect(holder.rpcCalls).toEqual([
      { fn: "withdraw_vacancy_application", args: { p_application_id: APPLICATION_ID } },
    ]);
  });

  it("withdrawing twice is not an error", async () => {
    setMock(signedIn, () => ({ data: { status: "already_withdrawn" } }));
    expect((await withdraw()).status).toBe(200);
  });

  it("404 for someone else's or a missing application", async () => {
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await withdraw()).status).toBe(404);
  });

  it("500 when the database call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setMock(signedIn, () => ({ error: { message: "boom" } }));
    expect((await withdraw()).status).toBe(500);
  });
});
