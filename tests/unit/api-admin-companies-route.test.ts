import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null, isAdmin: true },
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
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/companies", () => ({
  notifyCompanyVerified: vi.fn(async () => undefined),
  getCompanyRole: vi.fn(async () => null),
  isCompanyLogoUrl: vi.fn(() => false),
  deleteCompanyLogo: vi.fn(async () => undefined),
}));

import { PATCH } from "@/app/api/admin/companies/[id]/route";
import { DELETE as DELETE_LOGO, PUT as PUT_LOGO } from "@/app/api/companies/[id]/logo/route";
import {
  deleteCompanyLogo,
  getCompanyRole,
  isCompanyLogoUrl,
  notifyCompanyVerified,
} from "@/lib/db/companies";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const admin: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(
  user: MockUser,
  resolve: (call: QueryCall) => QueryResult,
  rpc: (fn: string, args?: unknown) => QueryResult = () => ({ data: { items: [] } }),
) {
  holder.mock = createSupabaseMock({ user, resolve, rpc });
  return holder.mock;
}

function req(method: string, body?: unknown) {
  return new Request("http://test", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: COMPANY_ID }) };
const existing = (patch: Record<string, unknown> = {}) => ({
  data: { id: COMPANY_ID, verified_at: null, moderation_status: "approved", ...patch },
});

beforeEach(() => {
  holder.isAdmin = true;
});

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PATCH /api/admin/companies/:id", () => {
  it("401 for guests and 403 for non-admins", async () => {
    setMock(null, () => existing());
    expect((await PATCH(req("PATCH", { verified: true }), params)).status).toBe(401);
    holder.isAdmin = false;
    setMock(admin, () => existing());
    expect((await PATCH(req("PATCH", { verified: true }), params)).status).toBe(403);
  });

  it("400 with nothing to change", async () => {
    setMock(admin, () => existing());
    expect((await PATCH(req("PATCH", {}), params)).status).toBe(400);
  });

  it("404 for an unknown company", async () => {
    setMock(admin, () => ({ data: null }));
    expect((await PATCH(req("PATCH", { verified: true }), params)).status).toBe(404);
  });

  it("confirms the page as an admin and tells the team", async () => {
    const mock = setMock(admin, () => existing());
    expect((await PATCH(req("PATCH", { verified: true }), params)).status).toBe(200);
    const update = mock.calls.find((entry) => entry.verb === "update");
    expect(update?.payload).toMatchObject({
      verification_method: "admin",
      verified_by: ADMIN_ID,
    });
    expect(notifyCompanyVerified).toHaveBeenCalledWith({ companyId: COMPANY_ID });
  });

  it("does not stamp an already verified page again", async () => {
    const mock = setMock(admin, () => existing({ verified_at: "2026-09-01T00:00:00Z" }));
    expect((await PATCH(req("PATCH", { verified: true }), params)).status).toBe(200);
    expect(mock.calls.some((entry) => entry.verb === "update")).toBe(false);
    expect(notifyCompanyVerified).not.toHaveBeenCalled();
  });

  it("takes the mark off", async () => {
    const mock = setMock(admin, () => existing({ verified_at: "2026-09-01T00:00:00Z" }));
    expect((await PATCH(req("PATCH", { verified: false }), params)).status).toBe(200);
    const update = mock.calls.find((entry) => entry.verb === "update");
    expect(update?.payload).toEqual({
      verified_at: null,
      verification_method: null,
      verified_by: null,
    });
  });

  it("hides a page through moderate_content (the database logs it and tells the team)", async () => {
    const rpc = vi.fn<(fn: string, args?: unknown) => QueryResult>(() => ({ data: { items: [] } }));
    const mock = setMock(admin, () => existing(), rpc);
    const res = await PATCH(
      req("PATCH", { moderation_status: "removed", moderation_note: "fake employer" }),
      params,
    );
    expect(res.status).toBe(200);
    expect(mock.calls.some((entry) => entry.verb === "update")).toBe(false);
    expect(rpc).toHaveBeenCalledWith("moderate_content", {
      p_target_type: "company",
      p_target_ids: [COMPANY_ID],
      p_status: "removed",
      p_note: "fake employer",
      p_report_id: null,
      p_report_status: null,
    });
  });

  it("passes the database's refusal on", async () => {
    setMock(admin, () => existing(), () => ({ data: null, error: { code: "42501", message: "only platform admins" } }));
    expect((await PATCH(req("PATCH", { moderation_status: "removed" }), params)).status).toBe(403);
  });
});

describe("/api/companies/:id/logo", () => {
  it("403 for people who cannot edit the page", async () => {
    holder.isAdmin = false;
    setMock(admin, () => ({ data: [{ id: COMPANY_ID }] }));
    vi.mocked(getCompanyRole).mockResolvedValueOnce("recruiter");
    expect((await PUT_LOGO(req("PUT", { logoUrl: "https://cdn.example/x" }), params)).status).toBe(403);
  });

  it("400 for a file that is not the company's own logo", async () => {
    setMock(admin, () => ({ data: [{ id: COMPANY_ID }] }));
    expect(
      (await PUT_LOGO(req("PUT", { logoUrl: "https://evil.example/logo.png" }), params)).status,
    ).toBe(400);
  });

  it("saves the company's own upload", async () => {
    const mock = setMock(admin, () => ({ data: [{ id: COMPANY_ID }] }));
    vi.mocked(isCompanyLogoUrl).mockReturnValueOnce(true);
    const logoUrl = `https://cdn.example/companies/${COMPANY_ID}/logo?v=1`;
    const res = await PUT_LOGO(req("PUT", { logoUrl }), params);
    expect(res.status).toBe(200);
    expect(mock.calls.find((entry) => entry.verb === "update")?.payload).toEqual({
      logo_url: logoUrl,
    });
  });

  it("removes the logo and its file", async () => {
    setMock(admin, () => ({ data: [{ id: COMPANY_ID }] }));
    expect((await DELETE_LOGO(req("DELETE"), params)).status).toBe(200);
    expect(deleteCompanyLogo).toHaveBeenCalledWith(COMPANY_ID);
  });
});
