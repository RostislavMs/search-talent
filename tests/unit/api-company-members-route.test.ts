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
  notifyCompanyInvite: vi.fn(async () => undefined),
  notifyCompanyInviteResponse: vi.fn(async () => undefined),
  notifyCompanyMemberLeft: vi.fn(async () => undefined),
  notifyCompanyMemberRemoved: vi.fn(async () => undefined),
  listPendingCompanyInvitations: vi.fn(async () => []),
}));

import { POST } from "@/app/api/companies/[id]/members/route";
import { DELETE, PATCH } from "@/app/api/companies/[id]/members/[memberId]/route";
import { GET as LIST } from "@/app/api/company-invitations/route";
import { PATCH as RESPOND } from "@/app/api/company-invitations/[id]/route";
import {
  listPendingCompanyInvitations,
  notifyCompanyInvite,
  notifyCompanyInviteResponse,
  notifyCompanyMemberLeft,
  notifyCompanyMemberRemoved,
} from "@/lib/db/companies";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_COMPANY = "33333333-3333-4333-8333-333333333333";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const INVITEE = "55555555-5555-4555-8555-555555555555";
const signedIn: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(
  user: MockUser,
  options: {
    rpc?: (fn: string, args?: unknown) => QueryResult;
    resolve?: (call: QueryCall) => QueryResult;
  } = {},
) {
  holder.mock = createSupabaseMock({
    user,
    resolve: options.resolve ?? (() => ({ data: { company_id: COMPANY_ID } })),
    rpc: options.rpc,
  });
  return holder.mock;
}

function req(body?: unknown) {
  return new Request("http://test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const companyParams = { params: Promise.resolve({ id: COMPANY_ID }) };
const memberParams = { params: Promise.resolve({ id: COMPANY_ID, memberId: MEMBER_ID }) };

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/companies/:id/members", () => {
  it("401 for guests", async () => {
    setMock(null);
    expect((await POST(req({ userId: INVITEE }), companyParams)).status).toBe(401);
  });

  it("400 for an owner invitation or a bad user id", async () => {
    setMock(signedIn);
    expect((await POST(req({ userId: INVITEE, role: "owner" }), companyParams)).status).toBe(400);
    expect((await POST(req({ userId: "nope" }), companyParams)).status).toBe(400);
  });

  it("passes the rate limiter's answer through", async () => {
    setMock(signedIn);
    const { NextResponse } = await import("next/server");
    vi.mocked(dbRateLimit).mockResolvedValueOnce(NextResponse.json({}, { status: 429 }));
    expect((await POST(req({ userId: INVITEE }), companyParams)).status).toBe(429);
  });

  it.each([
    ["forbidden", 403],
    ["user_not_found", 404],
    ["already_invited", 409],
    ["member_limit", 409],
    ["invitee_limit", 409],
  ])("turns %s into %i with the code", async (status, http) => {
    setMock(signedIn, { rpc: () => ({ data: { status } }) });
    const res = await POST(req({ userId: INVITEE }), companyParams);
    expect(res.status).toBe(http);
    expect((await res.json()).code).toBe(status);
    expect(notifyCompanyInvite).not.toHaveBeenCalled();
  });

  it("invites through the database function and notifies the person", async () => {
    let rpcCall: { fn: string; args: unknown } | null = null;
    setMock(signedIn, {
      rpc: (fn, args) => {
        rpcCall = { fn, args };
        return { data: { status: "ok", member_id: MEMBER_ID } };
      },
    });
    const res = await POST(req({ userId: INVITEE, role: "admin" }), companyParams);
    expect(res.status).toBe(201);
    expect(rpcCall).toEqual({
      fn: "invite_company_member",
      args: { p_company_id: COMPANY_ID, p_user_id: INVITEE, p_role: "admin" },
    });
    expect(notifyCompanyInvite).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      memberId: MEMBER_ID,
      inviteeUserId: INVITEE,
      actorUserId: USER_ID,
      role: "admin",
    });
  });
});

describe("PATCH/DELETE /api/companies/:id/members/:memberId", () => {
  it("404 when the member belongs to another company", async () => {
    setMock(signedIn, { resolve: () => ({ data: { company_id: OTHER_COMPANY } }) });
    const res = await PATCH(req({ role: "admin" }), memberParams);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
  });

  it("changes a role", async () => {
    setMock(signedIn, { rpc: () => ({ data: { status: "ok" } }) });
    expect((await PATCH(req({ role: "admin" }), memberParams)).status).toBe(200);
  });

  it("refuses to demote the last owner", async () => {
    setMock(signedIn, { rpc: () => ({ data: { status: "last_owner" } }) });
    const res = await PATCH(req({ role: "admin" }), memberParams);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("last_owner");
  });

  it("400 for an unknown role", async () => {
    setMock(signedIn);
    expect((await PATCH(req({ role: "boss" }), memberParams)).status).toBe(400);
  });

  it("removes a member or leaves", async () => {
    let fnName = "";
    setMock(signedIn, {
      rpc: (fn) => {
        fnName = fn;
        return { data: { status: "ok" } };
      },
    });
    expect((await DELETE(req(), memberParams)).status).toBe(200);
    expect(fnName).toBe("remove_company_member");
  });

  it("401 for guests", async () => {
    setMock(null);
    expect((await DELETE(req(), memberParams)).status).toBe(401);
  });

  it("tells the team when someone leaves", async () => {
    setMock(signedIn, {
      rpc: () => ({ data: { status: "ok", user_id: USER_ID, was_member: true, left: true } }),
    });
    await DELETE(req(), memberParams);
    expect(notifyCompanyMemberLeft).toHaveBeenCalledWith({ companyId: COMPANY_ID, userId: USER_ID });
    expect(notifyCompanyMemberRemoved).not.toHaveBeenCalled();
  });

  it("tells the person when they are removed", async () => {
    setMock(signedIn, {
      rpc: () => ({ data: { status: "ok", user_id: INVITEE, was_member: true, left: false } }),
    });
    await DELETE(req(), memberParams);
    expect(notifyCompanyMemberRemoved).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      userId: INVITEE,
      actorUserId: USER_ID,
    });
  });

  it("stays quiet for a cancelled invitation", async () => {
    setMock(signedIn, {
      rpc: () => ({ data: { status: "ok", user_id: INVITEE, was_member: false, left: false } }),
    });
    await DELETE(req(), memberParams);
    expect(notifyCompanyMemberLeft).not.toHaveBeenCalled();
    expect(notifyCompanyMemberRemoved).not.toHaveBeenCalled();
  });
});

describe("/api/company-invitations", () => {
  it("gives guests an empty list", async () => {
    setMock(null);
    expect(await (await LIST()).json()).toEqual({ invitations: [] });
    expect(listPendingCompanyInvitations).not.toHaveBeenCalled();
  });

  it("lists the caller's invitations", async () => {
    setMock(signedIn);
    await LIST();
    expect(listPendingCompanyInvitations).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  const invitationParams = { params: Promise.resolve({ id: MEMBER_ID }) };

  it("400 for a bad action", async () => {
    setMock(signedIn);
    expect((await RESPOND(req({ action: "maybe" }), invitationParams)).status).toBe(400);
  });

  it("409 when accepting would make a fourth company", async () => {
    setMock(signedIn, { rpc: () => ({ data: { status: "membership_limit" } }) });
    const res = await RESPOND(req({ action: "accept" }), invitationParams);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("membership_limit");
  });

  it("404 when the invitation is not the caller's or already answered", async () => {
    setMock(signedIn, { rpc: () => ({ data: { status: "not_found" } }) });
    expect((await RESPOND(req({ action: "accept" }), invitationParams)).status).toBe(404);
    expect(notifyCompanyInviteResponse).not.toHaveBeenCalled();
  });

  it("accepts and tells the inviter", async () => {
    setMock(signedIn, {
      rpc: () => ({ data: { status: "ok", company_id: COMPANY_ID, invited_by: INVITEE } }),
    });
    const res = await RESPOND(req({ action: "accept" }), invitationParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "accepted" });
    expect(notifyCompanyInviteResponse).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      inviterUserId: INVITEE,
      actorUserId: USER_ID,
      accepted: true,
    });
  });
});
