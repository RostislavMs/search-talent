import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/trash", () => ({
  deleteAccount: vi.fn(async () => ({ ok: true, groupId: "33333333-3333-4333-8333-333333333333" })),
}));

import { POST } from "@/app/api/profile/delete/confirm/route";
import { deleteAccount } from "@/lib/db/trash";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-22T12:00:00.000Z");

// A user whose delete OTP was requested `agoMs` before "now".
function buildUser(agoMs: number | null) {
  return {
    id: USER_ID,
    email: "user@example.test",
    user_metadata:
      agoMs === null
        ? {}
        : { delete_otp_requested_at: new Date(NOW.getTime() - agoMs).toISOString() },
  };
}

type UpdateResult = { error: { message: string } | null };

function buildSupabase(user: unknown, updateResult: UpdateResult = { error: null }) {
  const signOut = vi.fn(async () => ({}));
  const updateUser = vi.fn(async () => updateResult);
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user } })),
        updateUser,
        signOut,
      },
    },
    signOut,
    updateUser,
  };
}

const ADMIN = { service: true };

function req(body: unknown) {
  return new Request("http://test/api/profile/delete/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(rateLimit).mockReturnValue(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("POST /api/profile/delete/confirm", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(null).supabase as never);
    expect((await POST(req({ code: "123456" }))).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(buildUser(60_000)).supabase as never);
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req({ code: "123456" }))).status).toBe(429);
  });

  it("400 on a malformed code", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(buildUser(60_000)).supabase as never);
    expect((await POST(req({ code: "abc" }))).status).toBe(400);
  });

  it("400 (code_expired) when the OTP is older than the TTL", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(buildUser(10 * 60_000)).supabase as never);
    const res = await POST(req({ code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("code_expired");
  });

  it("400 (invalid_code) when the nonce verification fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildSupabase(buildUser(60_000), { error: { message: "bad nonce" } }).supabase as never,
    );
    const res = await POST(req({ code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_code");
  });

  it("500 when the admin client is not configured", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(buildUser(60_000)).supabase as never);
    vi.mocked(createAdminClient).mockReturnValue(null as never);
    expect((await POST(req({ code: "123456" }))).status).toBe(500);
  });

  it("moves the account into the trash with the service key and ends every session", async () => {
    const { supabase, signOut } = buildSupabase(buildUser(60_000));
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createAdminClient).mockReturnValue(ADMIN as never);

    const res = await POST(req({ code: "123456", mode: "erase" }));
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(ADMIN, USER_ID, "erase");
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("passes the anonymize choice to the database", async () => {
    const { supabase } = buildSupabase(buildUser(60_000));
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createAdminClient).mockReturnValue(ADMIN as never);

    const res = await POST(req({ code: "123456", mode: "anonymize" }));
    expect(res.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith(ADMIN, USER_ID, "anonymize");
  });

  it("409 when the account is already waiting for deletion; no sign-out", async () => {
    const { supabase, signOut } = buildSupabase(buildUser(60_000));
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createAdminClient).mockReturnValue(ADMIN as never);
    vi.mocked(deleteAccount).mockResolvedValueOnce({ ok: false, code: "already_deleted" });

    const res = await POST(req({ code: "123456" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("already_deleted");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("400 when the database refuses", async () => {
    const { supabase, signOut } = buildSupabase(buildUser(60_000));
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    vi.mocked(createAdminClient).mockReturnValue(ADMIN as never);
    vi.mocked(deleteAccount).mockResolvedValueOnce({ ok: false, code: "failed" });

    expect((await POST(req({ code: "123456" }))).status).toBe(400);
    expect(signOut).not.toHaveBeenCalled();
  });
});
