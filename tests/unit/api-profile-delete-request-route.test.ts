import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));

import { POST } from "@/app/api/profile/delete/request/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildSupabase(user: unknown, reauthError: { message: string } | null = null) {
  const reauthenticate = vi.fn(async () => ({ error: reauthError }));
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user } })),
        reauthenticate,
      },
    },
    reauthenticate,
  };
}

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => vi.clearAllMocks());

describe("POST /api/profile/delete/request", () => {
  it("401 when unauthenticated", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase(null).supabase as never);
    expect((await POST()).status).toBe(401);
  });

  it("400 when the account has no email", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({ id: USER_ID, email: null }).supabase as never);
    expect((await POST()).status).toBe(400);
  });

  it("returns the rate-limit response when limited", async () => {
    vi.mocked(createClient).mockResolvedValue(buildSupabase({ id: USER_ID, email: "u@x.test" }).supabase as never);
    vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST()).status).toBe(429);
  });

  it("400 when reauthentication fails", async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildSupabase({ id: USER_ID, email: "u@x.test" }, { message: "smtp down" }).supabase as never,
    );
    vi.mocked(createAdminClient).mockReturnValue(null as never);
    expect((await POST()).status).toBe(400);
  });

  it("stamps the OTP timestamp and triggers reauthentication", async () => {
    const { supabase, reauthenticate } = buildSupabase({ id: USER_ID, email: "u@x.test", user_metadata: {} });
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const updateUserById = vi.fn(async () => ({ error: null }));
    vi.mocked(createAdminClient).mockReturnValue({ auth: { admin: { updateUserById } } } as never);

    const res = await POST();
    expect(res.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledOnce();
    expect(reauthenticate).toHaveBeenCalledOnce();
  });
});
