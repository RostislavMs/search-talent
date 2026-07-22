import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/gif/provider", () => ({
  isGifSearchConfigured: vi.fn(() => true),
  searchGifs: vi.fn(async () => [{ id: "g1" }]),
}));

import { GET } from "@/app/api/gif/search/route";
import { dbRateLimit } from "@/lib/rate-limit";
import { isGifSearchConfigured, searchGifs } from "@/lib/gif/provider";

const authUser: MockUser = { id: "11111111-1111-4111-8111-111111111111", email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}
const req = (qs = "?q=cat") => new Request(`http://test/api/gif/search${qs}`);

beforeEach(() => {
  vi.mocked(isGifSearchConfigured).mockReturnValue(true);
  vi.mocked(dbRateLimit).mockResolvedValue(null);
});
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/gif/search", () => {
  it("503 when not configured", async () => {
    vi.mocked(isGifSearchConfigured).mockReturnValue(false);
    setUser(authUser);
    expect((await GET(req())).status).toBe(503);
  });

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    setUser(authUser);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await GET(req())).status).toBe(429);
  });

  it("proxies to the provider and returns gifs", async () => {
    setUser(authUser);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).gifs).toEqual([{ id: "g1" }]);
  });

  it("502 when the provider throws", async () => {
    setUser(authUser);
    vi.mocked(searchGifs).mockRejectedValueOnce(new Error("giphy down"));
    expect((await GET(req())).status).toBe(502);
  });
});
