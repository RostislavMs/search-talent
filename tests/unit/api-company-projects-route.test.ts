import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/db/companies", () => ({
  notifyCompanyProjectRequest: vi.fn(async () => undefined),
  notifyCompanyProjectDecision: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/companies/[id]/projects/route";
import { DELETE, POST as CONFIRM } from "@/app/api/companies/[id]/projects/[projectId]/route";
import { notifyCompanyProjectDecision, notifyCompanyProjectRequest } from "@/lib/db/companies";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const signedIn: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

const ownPublished = { owner_id: USER_ID, status: "published", moderation_status: "approved" };

function setMock(
  user: MockUser,
  resolve: (call: QueryCall) => QueryResult,
  rpc?: (fn: string, args?: unknown) => QueryResult,
) {
  holder.mock = createSupabaseMock({ user, resolve, rpc });
  return holder.mock;
}

function req(body?: unknown) {
  return new Request("http://test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: COMPANY_ID }) };
const linkParams = { params: Promise.resolve({ id: COMPANY_ID, projectId: PROJECT_ID }) };

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/companies/:id/projects", () => {
  it("401 for guests and 400 for a bad project id", async () => {
    setMock(null, () => ({}));
    expect((await POST(req({ projectId: PROJECT_ID }), params)).status).toBe(401);
    setMock(signedIn, () => ({}));
    expect((await POST(req({ projectId: "nope" }), params)).status).toBe(400);
  });

  it("403 for someone else's project", async () => {
    setMock(signedIn, () => ({ data: { ...ownPublished, owner_id: "someone" } }));
    const res = await POST(req({ projectId: PROJECT_ID }), params);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
  });

  it("asks to publish a draft first", async () => {
    setMock(signedIn, () => ({ data: { ...ownPublished, status: "draft" } }));
    expect((await (await POST(req({ projectId: PROJECT_ID }), params)).json()).code).toBe("not_published");
  });

  it("attaches the caller's own published project", async () => {
    const mock = setMock(signedIn, (call) =>
      call.table === "projects" ? { data: ownPublished } : { data: { status: "approved" } },
    );
    const res = await POST(req({ projectId: PROJECT_ID }), params);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: "approved" });
    expect(notifyCompanyProjectRequest).not.toHaveBeenCalled();
    expect(mock.calls.find((call) => call.verb === "insert")?.payload).toEqual({
      company_id: COMPANY_ID,
      project_id: PROJECT_ID,
      added_by: USER_ID,
    });
  });

  it.each([
    [{ code: "23505", message: "duplicate" }, 409, "already_added"],
    [{ code: "P0001", message: "company_projects_limit_reached" }, 409, "limit"],
    [{ code: "42501", message: "row-level security" }, 403, "forbidden"],
    [{ code: "P0001", message: "project_companies_limit_reached" }, 409, "project_limit"],
  ])("maps %o to %i %s", async (error, status, code) => {
    setMock(signedIn, (call) => (call.table === "projects" ? { data: ownPublished } : { error }));
    const res = await POST(req({ projectId: PROJECT_ID }), params);
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });
});

describe("requests from outside authors", () => {
  it("turns a non-member's project into a request and tells the company", async () => {
    setMock(signedIn, (call) =>
      call.table === "projects" ? { data: ownPublished } : { data: { status: "pending" } },
    );
    const res = await POST(req({ projectId: PROJECT_ID }), params);
    expect(await res.json()).toEqual({ status: "pending" });
    expect(notifyCompanyProjectRequest).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      actorUserId: USER_ID,
    });
  });
});

describe("POST /api/companies/:id/projects/:projectId (confirm)", () => {
  it("confirms through the database function and tells the author", async () => {
    let called: { fn: string; args: unknown } | null = null;
    setMock(signedIn, () => ({}), (fn, args) => {
      called = { fn, args };
      return { data: { status: "ok", owner_id: "author", was_request: true } };
    });
    expect((await CONFIRM(req(), linkParams)).status).toBe(200);
    expect(called).toEqual({
      fn: "confirm_company_project",
      args: { p_company_id: COMPANY_ID, p_project_id: PROJECT_ID },
    });
    expect(notifyCompanyProjectDecision).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      actorUserId: USER_ID,
      confirmed: true,
    });
  });

  it.each([
    ["own_project", 403],
    ["forbidden", 403],
    ["not_found", 404],
  ])("refuses %s with %i", async (status, http) => {
    setMock(signedIn, () => ({}), () => ({ data: { status } }));
    const res = await CONFIRM(req(), linkParams);
    expect(res.status).toBe(http);
    expect((await res.json()).code).toBe(status);
    expect(notifyCompanyProjectDecision).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/companies/:id/projects/:projectId", () => {
  it("tells the author when the company turns a request down", async () => {
    setMock(signedIn, (call) =>
      call.verb === "select"
        ? { data: { status: "pending", project: { owner_id: "author" } } }
        : { data: [{ project_id: PROJECT_ID }] },
    );
    expect((await DELETE(req(), linkParams)).status).toBe(200);
    expect(notifyCompanyProjectDecision).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      projectId: PROJECT_ID,
      actorUserId: USER_ID,
      confirmed: false,
    });
  });

  it("says nothing when the author takes their own project off", async () => {
    setMock(signedIn, (call) =>
      call.verb === "select"
        ? { data: { status: "approved", project: { owner_id: USER_ID } } }
        : { data: [{ project_id: PROJECT_ID }] },
    );
    await DELETE(req(), linkParams);
    expect(notifyCompanyProjectDecision).not.toHaveBeenCalled();
  });

  it("401 for guests", async () => {
    setMock(null, () => ({}));
    expect((await DELETE(req(), linkParams)).status).toBe(401);
  });

  it("404 when the policy removed nothing", async () => {
    setMock(signedIn, () => ({ data: [] }));
    expect((await DELETE(req(), linkParams)).status).toBe(404);
  });

  it("takes the project off the page", async () => {
    const mock = setMock(signedIn, () => ({ data: [{ project_id: PROJECT_ID }] }));
    expect((await DELETE(req(), linkParams)).status).toBe(200);
    const deleted = mock.calls.find((call) => call.verb === "delete");
    expect(deleted?.filters).toEqual([
      { method: "eq", args: ["company_id", COMPANY_ID] },
      { method: "eq", args: ["project_id", PROJECT_ID] },
    ]);
  });
});
