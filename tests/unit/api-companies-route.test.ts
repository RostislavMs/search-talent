import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null, isAdmin: false },
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
vi.mock("@/lib/db/companies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/companies")>();
  return {
    ...actual,
    getCompanyRole: vi.fn(async () => null),
    holdCompanyForReview: vi.fn(async () => true),
    deleteCompanyLogo: vi.fn(async () => undefined),
  };
});

import { POST } from "@/app/api/companies/route";
import { DELETE, PATCH } from "@/app/api/companies/[id]/route";
import { deleteCompanyLogo, getCompanyRole, holdCompanyForReview } from "@/lib/db/companies";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const confirmed: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const unconfirmed: MockUser = { id: USER_ID, email_confirmed_at: null };

const payload = {
  name: "Acme",
  slug: "acme",
  type: "company",
  description: "We build things",
  website: "acme.com",
  size: "11-50",
  country_id: null,
  city: "Kyiv",
};

function setMock(user: MockUser, resolve: (call: QueryCall) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve });
  return holder.mock;
}

function req(method: string, body?: unknown) {
  return new Request("http://test/api/companies", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id = COMPANY_ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  holder.isAdmin = false;
  vi.mocked(getCompanyRole).mockResolvedValue(null);
});

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/companies", () => {
  it("401 for guests", async () => {
    setMock(null);
    expect((await POST(req("POST", payload))).status).toBe(401);
  });

  it("403 with a code when the email is not confirmed", async () => {
    setMock(unconfirmed);
    const res = await POST(req("POST", payload));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("email_unconfirmed");
  });

  it("passes the rate limiter's answer through", async () => {
    setMock(confirmed);
    const { NextResponse } = await import("next/server");
    vi.mocked(dbRateLimit).mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    expect((await POST(req("POST", payload))).status).toBe(429);
  });

  it("400 for an invalid payload", async () => {
    setMock(confirmed);
    const res = await POST(req("POST", { ...payload, slug: "new" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid");
  });

  it("creates the page with the caller as creator and without a logo", async () => {
    const mock = setMock(confirmed, (call) =>
      call.table === "companies" ? { data: { id: COMPANY_ID, slug: "acme" } } : {},
    );
    const res = await POST(req("POST", { ...payload, logo_url: "https://evil.example/x.png" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      company: { id: COMPANY_ID, slug: "acme" },
      heldForReview: false,
    });

    const insert = mock.calls.find((call) => call.verb === "insert");
    expect(insert?.payload).toMatchObject({
      name: "Acme",
      slug: "acme",
      website: "https://acme.com",
      created_by: USER_ID,
    });
    expect(insert?.payload).not.toHaveProperty("logo_url");
    expect(insert?.payload).not.toHaveProperty("verified_at");
    expect(holdCompanyForReview).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "23505", message: "duplicate key" }, 409, "slug_taken"],
    [{ code: "P0001", message: "company_limit_reached" }, 409, "limit"],
    [{ code: "42501", message: "row-level security" }, 403, "email_unconfirmed"],
    [{ code: "23514", message: "check constraint" }, 400, "invalid"],
  ])("maps a database error %o to %i %s", async (error, status, code) => {
    setMock(confirmed, () => ({ error }));
    const res = await POST(req("POST", payload));
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });

  it("holds a page whose text trips auto-moderation", async () => {
    setMock(confirmed, () => ({ data: { id: COMPANY_ID, slug: "acme" } }));
    const res = await POST(
      req("POST", { ...payload, description: "Buy now ".repeat(5) + "FUCK" }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).heldForReview).toBe(true);
    expect(holdCompanyForReview).toHaveBeenCalledWith(COMPANY_ID, expect.stringContaining("[авто]"));
  });
});

describe("PATCH /api/companies/:id", () => {
  it("400 for a bad id", async () => {
    setMock(confirmed);
    expect((await PATCH(req("PATCH", payload), params("nope"))).status).toBe(400);
  });

  it("401 for guests", async () => {
    setMock(null);
    expect((await PATCH(req("PATCH", payload), params())).status).toBe(401);
  });

  it("403 for recruiters and strangers", async () => {
    setMock(confirmed);
    vi.mocked(getCompanyRole).mockResolvedValueOnce("recruiter");
    expect((await PATCH(req("PATCH", payload), params())).status).toBe(403);
    expect((await PATCH(req("PATCH", payload), params())).status).toBe(403);
  });

  it("lets a platform admin edit any page", async () => {
    holder.isAdmin = true;
    setMock(confirmed, (call) =>
      call.verb === "update"
        ? { data: { id: COMPANY_ID, slug: "acme", verified_at: null } }
        : { data: { id: COMPANY_ID, verified_at: null } },
    );
    expect((await PATCH(req("PATCH", payload), params())).status).toBe(200);
  });

  it("404 when the page is gone", async () => {
    setMock(confirmed, () => ({ data: null }));
    vi.mocked(getCompanyRole).mockResolvedValueOnce("owner");
    expect((await PATCH(req("PATCH", payload), params())).status).toBe(404);
  });

  it("saves and reports that the check mark came off", async () => {
    const mock = setMock(confirmed, (call) =>
      call.verb === "update"
        ? { data: { id: COMPANY_ID, slug: "acme", verified_at: null } }
        : { data: { id: COMPANY_ID, verified_at: "2026-09-01T00:00:00Z" } },
    );
    vi.mocked(getCompanyRole).mockResolvedValueOnce("admin");
    const res = await PATCH(req("PATCH", { ...payload, name: "Acme Two" }), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      company: { id: COMPANY_ID, slug: "acme" },
      heldForReview: false,
      verificationLost: true,
    });
    const update = mock.calls.find((call) => call.verb === "update");
    expect(update?.payload).toMatchObject({ name: "Acme Two" });
    expect(update?.payload).not.toHaveProperty("moderation_status");
  });

  it("409 when the new address is taken", async () => {
    setMock(confirmed, (call) =>
      call.verb === "update"
        ? { error: { code: "23505", message: "duplicate" } }
        : { data: { id: COMPANY_ID, verified_at: null } },
    );
    vi.mocked(getCompanyRole).mockResolvedValueOnce("owner");
    const res = await PATCH(req("PATCH", payload), params());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("slug_taken");
  });
});

describe("DELETE /api/companies/:id", () => {
  it("403 for admins of the company: only owners delete", async () => {
    setMock(confirmed);
    vi.mocked(getCompanyRole).mockResolvedValueOnce("admin");
    expect((await DELETE(req("DELETE"), params())).status).toBe(403);
  });

  it("404 when nothing was deleted", async () => {
    setMock(confirmed, () => ({ data: [] }));
    vi.mocked(getCompanyRole).mockResolvedValueOnce("owner");
    expect((await DELETE(req("DELETE"), params())).status).toBe(404);
    expect(deleteCompanyLogo).not.toHaveBeenCalled();
  });

  it("deletes the page for the owner and keeps the logo for the trash", async () => {
    setMock(confirmed, () => ({ data: [{ id: COMPANY_ID }] }));
    vi.mocked(getCompanyRole).mockResolvedValueOnce("owner");
    expect((await DELETE(req("DELETE"), params())).status).toBe(200);
    // The page waits 60 days in the trash; the logo goes when it is erased.
    expect(deleteCompanyLogo).not.toHaveBeenCalled();
  });
});
