import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));

import { POST } from "@/app/api/profile-contacts/route";

const VIEWER: MockUser = { id: "22222222-2222-4222-8222-222222222222" };
const PROFILE_ID = "33333333-3333-4333-8333-333333333333";

function setMock(user: MockUser, rpcResult: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn(() => rpcResult);
  holder.mock = createSupabaseMock({ user, resolve: () => ({}), rpc });
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

  it("400 for a malformed profile id", async () => {
    const rpc = setMock(VIEWER, {});
    expect((await POST(req({ profileId: "nope" }))).status).toBe(400);
    expect((await POST(req({ profileId: PROFILE_ID, extra: 1 }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns email and phone through open_profile_contacts", async () => {
    const rpc = setMock(VIEWER, {
      data: { status: "ok", email: "olena@example.com", phone: "+380501112233" },
    });
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "olena@example.com", phone: "+380501112233" });
    expect(rpc).toHaveBeenCalledWith("open_profile_contacts", { p_profile_id: PROFILE_ID });
  });

  it("answers ok with nulls when nothing is on file", async () => {
    setMock(VIEWER, { data: { status: "ok", email: null, phone: null } });
    const res = await POST(req({ profileId: PROFILE_ID }));

    expect(await res.json()).toEqual({ email: null, phone: null });
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
