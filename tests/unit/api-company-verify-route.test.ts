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

vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: vi.fn(async () => {
    const client = holder.mock!.client;
    const {
      data: { user },
    } = await client.auth.getUser();
    return { supabase: client, user, isAdmin: false };
  }),
}));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "uk") }));
vi.mock("@/lib/email/resend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/resend")>()),
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(async () => ({ sent: true, id: "e1" })),
}));
vi.mock("@/lib/db/companies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/companies")>();
  return {
    ...actual,
    getCompanyById: vi.fn(),
    getCompanyRole: vi.fn(),
    notifyCompanyVerified: vi.fn(async () => undefined),
    generateCompanyVerificationCode: vi.fn(() => "123456"),
  };
});

import { POST as SEND } from "@/app/api/companies/[id]/verify/code/route";
import { POST } from "@/app/api/companies/[id]/verify/route";
import type { CompanyDetails } from "@/lib/companies";
import {
  getCompanyById,
  getCompanyRole,
  hashCompanyVerificationCode,
  notifyCompanyVerified,
} from "@/lib/db/companies";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";

function user(email: string, confirmed = true): MockUser {
  return { id: USER_ID, email, email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null };
}

const company = (patch: Partial<CompanyDetails> = {}): CompanyDetails => ({
  id: COMPANY_ID,
  slug: "acme",
  name: "Acme",
  type: "company",
  logoUrl: null,
  verified: false,
  moderationStatus: "approved",
  description: null,
  website: "https://acme.com",
  size: null,
  countryId: null,
  countryName: null,
  city: null,
  verifiedAt: null,
  verificationMethod: null,
  createdAt: "2026-09-30T00:00:00Z",
  updatedAt: "2026-09-30T00:00:00Z",
  ...patch,
});

function setUser(value: MockUser) {
  holder.mock = createSupabaseMock({ user: value, resolve: () => ({}) });
}

function setAdmin(resolve: (call: QueryCall) => QueryResult) {
  holder.admin = createSupabaseMock({ user: null, resolve });
  return holder.admin;
}

function req(body?: unknown) {
  return new Request("http://test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (id = COMPANY_ID) => ({ params: Promise.resolve({ id }) });

/** A stored code row, as the admin client returns it for the select. */
function codeRow(patch: Record<string, unknown> = {}) {
  return {
    email_domain: "acme.com",
    code_hash: hashCompanyVerificationCode("123456", COMPANY_ID, USER_ID),
    attempts: 0,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    ...patch,
  };
}

beforeEach(() => {
  vi.mocked(getCompanyById).mockResolvedValue(company());
  vi.mocked(getCompanyRole).mockResolvedValue("owner");
  vi.mocked(isEmailConfigured).mockReturnValue(true);
  vi.mocked(sendEmail).mockResolvedValue({ sent: true, id: "e1" });
});

afterEach(() => {
  holder.mock = null;
  holder.admin = null;
  vi.clearAllMocks();
});

describe("shared checks", () => {
  it("400 for a bad id and 401 for guests", async () => {
    setUser(user("jane@acme.com"));
    expect((await POST(req(), params("nope"))).status).toBe(400);
    setUser(null);
    expect((await POST(req(), params())).status).toBe(401);
  });

  it("passes the rate limiter's answer through", async () => {
    setUser(user("jane@acme.com"));
    const { NextResponse } = await import("next/server");
    vi.mocked(dbRateLimit).mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    expect((await SEND(req({ email: "jane@acme.com" }), params())).status).toBe(429);
  });

  it("404 when the page is not visible and 403 for recruiters", async () => {
    setUser(user("jane@acme.com"));
    vi.mocked(getCompanyById).mockResolvedValueOnce(null);
    expect((await POST(req(), params())).status).toBe(404);
    vi.mocked(getCompanyRole).mockResolvedValueOnce("recruiter");
    expect((await SEND(req({ email: "jane@acme.com" }), params())).status).toBe(403);
  });

  it("does nothing more for a page that is already verified", async () => {
    setUser(user("jane@acme.com"));
    const admin = setAdmin(() => ({}));
    vi.mocked(getCompanyById).mockResolvedValue(company({ verified: true }));
    expect((await POST(req(), params())).status).toBe(200);
    expect((await SEND(req({ email: "jane@acme.com" }), params())).status).toBe(200);
    expect(admin.calls).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("one click with the account email", () => {
  it.each([
    ["jane@gmail.com", true, "public_email"],
    ["jane@acme.io", true, "mismatch"],
    ["jane@acme.com", false, "email_unconfirmed"],
  ])("400 %s (confirmed: %s) → %s", async (email, confirmed, code) => {
    setUser(user(email, confirmed));
    setAdmin(() => ({}));
    const res = await POST(req(), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
  });

  it("503 without the service key", async () => {
    setUser(user("jane@acme.com"));
    expect((await POST(req(), params())).status).toBe(503);
  });

  it("writes the mark only for the site it checked", async () => {
    setUser(user("jane@acme.com"));
    const admin = setAdmin(() => ({ data: [{ id: COMPANY_ID }] }));
    expect((await POST(req(), params())).status).toBe(200);

    const update = admin.calls.find((entry) => entry.verb === "update");
    expect(update?.payload).toMatchObject({ verification_method: "email_domain", verified_by: USER_ID });
    expect(update?.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["website", "https://acme.com"] },
        { method: "is", args: ["verified_at", null] },
      ]),
    );
    expect(notifyCompanyVerified).toHaveBeenCalledWith({ companyId: COMPANY_ID, excludeUserId: USER_ID });
  });

  it("409 when the page changed in between", async () => {
    setUser(user("jane@acme.com"));
    setAdmin(() => ({ data: [] }));
    expect((await POST(req(), params())).status).toBe(409);
    expect(notifyCompanyVerified).not.toHaveBeenCalled();
  });
});

describe("POST /verify/code — sending the code", () => {
  it("sends a code to a work address that is not the sign-in address", async () => {
    setUser(user("jane@gmail.com"));
    const admin = setAdmin(() => ({}));
    const res = await SEND(req({ email: " Jane@Acme.com " }), params());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true, domain: "acme.com" });

    // Expired codes are cleared first, then this one is stored.
    expect(admin.calls[0]).toMatchObject({ table: "company_verification_codes", verb: "delete" });
    expect(admin.calls[0].filters[0]).toMatchObject({ method: "lt", args: ["expires_at", expect.any(String)] });
    const upsert = admin.calls.find((entry) => entry.verb === "upsert");
    expect(upsert?.table).toBe("company_verification_codes");
    const stored = upsert?.payload as Record<string, unknown>;
    expect(stored).toMatchObject({ company_id: COMPANY_ID, user_id: USER_ID, attempts: 0 });
    expect(stored.code_hash).toBe(hashCompanyVerificationCode("123456", COMPANY_ID, USER_ID));
    // The address itself is not stored anywhere.
    expect(JSON.stringify(stored)).not.toContain("jane");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@acme.com",
        subject: expect.stringContaining("123456"),
        text: expect.stringContaining("acme.com"),
      }),
    );
  });

  it("accepts the parent domain of a subdomain website", async () => {
    setUser(user("jane@gmail.com"));
    setAdmin(() => ({}));
    vi.mocked(getCompanyById).mockResolvedValueOnce(company({ website: "https://jobs.acme.com" }));
    const res = await SEND(req({ email: "jane@acme.com" }), params());
    expect(await res.json()).toEqual({ sent: true, domain: "acme.com" });
  });

  it.each([
    ["jane@gmail.com", "public_email"],
    ["jane@acme.io", "mismatch"],
    ["jane@mail.acme.com", "mismatch"],
    ["not an email", "invalid_email"],
  ])("400 for %s → %s, nothing sent", async (email, code) => {
    setUser(user("jane@gmail.com"));
    setAdmin(() => ({}));
    const res = await SEND(req({ email }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses schools and pages without a website", async () => {
    setUser(user("jane@gmail.com"));
    setAdmin(() => ({}));
    vi.mocked(getCompanyById).mockResolvedValueOnce(company({ type: "school" }));
    expect((await (await SEND(req({ email: "jane@acme.com" }), params())).json()).code).toBe("school");
    vi.mocked(getCompanyById).mockResolvedValueOnce(company({ website: null }));
    expect((await (await SEND(req({ email: "jane@acme.com" }), params())).json()).code).toBe("no_website");
  });

  it("503 when email is not configured", async () => {
    setUser(user("jane@gmail.com"));
    setAdmin(() => ({}));
    vi.mocked(isEmailConfigured).mockReturnValueOnce(false);
    const res = await SEND(req({ email: "jane@acme.com" }), params());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("email_unavailable");
  });

  it("drops the code again when the email could not be sent", async () => {
    setUser(user("jane@gmail.com"));
    const admin = setAdmin(() => ({}));
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, error: "status_500" });
    const res = await SEND(req({ email: "jane@acme.com" }), params());
    expect(res.status).toBe(502);
    const dropped = admin.calls.filter((entry) => entry.verb === "delete").at(-1);
    expect(dropped?.filters).toEqual([
      { method: "eq", args: ["company_id", COMPANY_ID] },
      { method: "eq", args: ["user_id", USER_ID] },
    ]);
  });
});

describe("POST /verify with a code", () => {
  function adminWithCode(row: Record<string, unknown> | null, updateResult: QueryResult = { data: [{ id: COMPANY_ID }] }) {
    return setAdmin((call) => {
      if (call.table === "company_verification_codes" && call.verb === "select") return { data: row };
      if (call.table === "companies") return updateResult;
      return {};
    });
  }

  it("verifies with the right code and drops it", async () => {
    setUser(user("jane@gmail.com"));
    const admin = adminWithCode(codeRow());
    const res = await POST(req({ code: "123456" }), params());
    expect(res.status).toBe(200);
    expect(admin.calls.some((entry) => entry.table === "company_verification_codes" && entry.verb === "delete")).toBe(true);
    expect(admin.calls.find((entry) => entry.table === "companies")?.payload).toMatchObject({
      verification_method: "email_domain",
    });
  });

  it("counts a wrong code", async () => {
    setUser(user("jane@gmail.com"));
    const admin = adminWithCode(codeRow({ attempts: 2 }));
    const res = await POST(req({ code: "654321" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("wrong_code");
    expect(admin.calls.find((entry) => entry.verb === "update")?.payload).toEqual({ attempts: 3 });
    expect(admin.calls.some((entry) => entry.table === "companies")).toBe(false);
  });

  it.each([
    [null, "code_missing"],
    [{ expires_at: new Date(Date.now() - 1000).toISOString() }, "code_expired"],
    [{ attempts: 5 }, "too_many_attempts"],
  ])("refuses %o → %s", async (patch, code) => {
    setUser(user("jane@gmail.com"));
    adminWithCode(patch === null ? null : codeRow(patch));
    const res = await POST(req({ code: "123456" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
  });

  it("does not accept a code sent for a site the page no longer has", async () => {
    setUser(user("jane@gmail.com"));
    vi.mocked(getCompanyById).mockResolvedValueOnce(company({ website: "https://other.example" }));
    const admin = adminWithCode(codeRow());
    const res = await POST(req({ code: "123456" }), params());
    expect(res.status).toBe(409);
    expect(admin.calls.some((entry) => entry.table === "companies")).toBe(false);
  });

  it("does not accept a code bound to another person or page", async () => {
    setUser(user("jane@gmail.com"));
    adminWithCode(codeRow({ code_hash: hashCompanyVerificationCode("123456", COMPANY_ID, "someone-else") }));
    expect((await (await POST(req({ code: "123456" }), params())).json()).code).toBe("wrong_code");
  });

  it("400 for a malformed code", async () => {
    setUser(user("jane@gmail.com"));
    setAdmin(() => ({}));
    expect((await POST(req({ code: "12ab56" }), params())).status).toBe(400);
  });
});
