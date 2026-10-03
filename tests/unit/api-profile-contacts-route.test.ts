import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type QueryCall, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/open-to", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/open-to")>()),
  notifyCompanyContactOpened: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/profile-contacts/route";
import { notifyCompanyContactOpened } from "@/lib/db/open-to";

const VIEWER: MockUser = { id: "22222222-2222-4222-8222-222222222222" };
const OWNER = "55555555-5555-4555-8555-555555555555";
const PROFILE_ID = "33333333-3333-4333-8333-333333333333";
const ACME = "44444444-4444-4444-8444-444444444444";

const MEMBERSHIPS = [
  { company: { id: ACME, name: "Acme", verified_at: "2026-09-30T10:00:00Z", moderation_status: "approved" } },
  { company: { id: "u1", name: "Unverified", verified_at: null, moderation_status: "approved" } },
  { company: [{ id: "h1", name: "Hidden", verified_at: "2026-09-30T10:00:00Z", moderation_status: "restricted" }] },
  { company: null },
];

function setMock(
  user: MockUser,
  rpcResult: { data?: unknown; error?: unknown },
  memberships: unknown[] = [],
) {
  const rpc = vi.fn(() => rpcResult);
  holder.mock = createSupabaseMock({
    user,
    resolve: (call: QueryCall) => (call.table === "company_members" ? { data: memberships } : {}),
    rpc,
  });
  return rpc;
}

function req(body: unknown) {
  return new Request("http://test/api/profile-contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/profile-contacts", () => {
  it("401 for a guest, without touching the database", async () => {
    const rpc = setMock(null, {});
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("unauthorized");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400 for a malformed profile or company id", async () => {
    const rpc = setMock(VIEWER, {});
    expect((await POST(req({ profileId: "nope" }))).status).toBe(400);
    expect((await POST(req({ profileId: PROFILE_ID, extra: 1 }))).status).toBe(400);
    expect((await POST(req({ profileId: PROFILE_ID, companyId: "acme" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns email and phone through open_profile_contacts", async () => {
    const rpc = setMock(VIEWER, {
      data: { status: "ok", email: "olena@example.com", phone: "+380501112233" },
    });
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      email: "olena@example.com",
      phone: "+380501112233",
      asCompanyId: null,
      companies: [],
    });
    // Without a company the call is the one the old database function takes too.
    expect(rpc).toHaveBeenCalledWith("open_profile_contacts", { p_profile_id: PROFILE_ID });
  });

  it("answers ok with nulls when nothing is on file", async () => {
    setMock(VIEWER, { data: { status: "ok", email: null, phone: null } });
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(await res.json()).toEqual({ email: null, phone: null, asCompanyId: null, companies: [] });
  });

  it("offers only verified, visible companies the visitor is in", async () => {
    setMock(VIEWER, { data: { status: "ok", email: "a@b.c", phone: null } }, MEMBERSHIPS);
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect((await res.json()).companies).toEqual([{ id: ACME, name: "Acme" }]);
  });

  it("opens as the company and tells the person the first time", async () => {
    const rpc = setMock(
      VIEWER,
      {
        data: {
          status: "ok",
          email: "a@b.c",
          phone: null,
          as_company: true,
          company_first_open: true,
          owner_user_id: OWNER,
        },
      },
      MEMBERSHIPS,
    );
    const res = await POST(req({ profileId: PROFILE_ID, companyId: ACME }));

    expect(res.status).toBe(200);
    expect((await res.json()).asCompanyId).toBe(ACME);
    expect(rpc).toHaveBeenCalledWith("open_profile_contacts", { p_profile_id: PROFILE_ID, p_company_id: ACME });
    expect(notifyCompanyContactOpened).toHaveBeenCalledWith({
      ownerUserId: OWNER,
      companyId: ACME,
      actorUserId: VIEWER!.id,
    });
  });

  it("does not notify again, nor for a colleague opened as a person", async () => {
    setMock(VIEWER, {
      data: { status: "ok", email: "a@b.c", phone: null, as_company: true, company_first_open: false, owner_user_id: OWNER },
    });
    expect((await (await POST(req({ profileId: PROFILE_ID, companyId: ACME }))).json()).asCompanyId).toBe(ACME);

    setMock(VIEWER, {
      data: { status: "ok", email: "a@b.c", phone: null, as_company: false, company_first_open: false, owner_user_id: OWNER },
    });
    expect((await (await POST(req({ profileId: PROFILE_ID, companyId: ACME }))).json()).asCompanyId).toBeNull();
    expect(notifyCompanyContactOpened).not.toHaveBeenCalled();
  });

  it("403 when the visitor cannot speak for the company, with the ones they can", async () => {
    setMock(VIEWER, { data: { status: "company_not_allowed" } }, MEMBERSHIPS);
    const res = await POST(req({ profileId: PROFILE_ID, companyId: ACME }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "company_not_allowed", companies: [{ id: ACME, name: "Acme" }] });
  });

  it("429 when the company opened too many today", async () => {
    setMock(VIEWER, { data: { status: "company_rate_limited" } });
    const res = await POST(req({ profileId: PROFILE_ID, companyId: ACME }));

    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("company_rate_limited");
  });

  it("429 when the account opened too many new profiles", async () => {
    setMock(VIEWER, { data: { status: "rate_limited" } });
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
  });

  it("404 for a hidden or missing profile", async () => {
    setMock(VIEWER, { data: { status: "not_found" } });
    expect((await POST(req({ profileId: PROFILE_ID }))).status).toBe(404);
  });

  it("503 when the function is not there yet (migration not applied)", async () => {
    setMock(VIEWER, { error: { message: "function open_profile_contacts does not exist" } });
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("unavailable");
  });
});
