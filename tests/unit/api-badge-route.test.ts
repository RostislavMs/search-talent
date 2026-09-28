import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type SupabaseMock } from "./helpers/supabase-mock";

const { holder, ratings } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null },
  ratings: { value: {} as Record<string, number> },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createPublicReadOnlyClient: vi.fn(() => holder.mock?.client ?? null),
  createAdminClient: vi.fn(() => null),
}));
vi.mock("@/lib/db/leaderboards", () => ({
  getCreatorRatings: vi.fn(async () => ratings.value),
}));

import { GET } from "@/app/api/badge/[username]/route";

function setProfile(profile: { id: string; moderation_status: string | null } | null) {
  holder.mock = createSupabaseMock({ resolve: () => ({ data: profile }) });
  return holder.mock;
}

function call(segment: string) {
  return GET(new Request(`http://test/api/badge/${segment}`), {
    params: Promise.resolve({ username: segment }),
  });
}

afterEach(() => {
  holder.mock = null;
  ratings.value = {};
  vi.clearAllMocks();
});

describe("GET /api/badge/[username].svg", () => {
  it("shows the profile's rating, cached by the CDN", async () => {
    const mock = setProfile({ id: "p1", moderation_status: "approved" });
    ratings.value = { p1: 72 };

    const response = await call("olena.koval.svg");
    const svg = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(svg).toContain(">72/100</text>");

    const [lookup] = mock.calls as QueryCall[];
    expect(lookup.table).toBe("profiles");
    expect(lookup.filters).toContainEqual({ method: "eq", args: ["username", "olena.koval"] });
  });

  it("works without the .svg suffix and says portfolio before a rating exists", async () => {
    setProfile({ id: "p2", moderation_status: null });

    const response = await call("olena");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(">portfolio</text>");
  });

  it("answers a grey not-found badge for a hidden or unknown profile", async () => {
    setProfile({ id: "p3", moderation_status: "removed" });
    const hidden = await call("hidden.svg");
    expect(hidden.status).toBe(404);
    expect(await hidden.text()).toContain(">not found</text>");
    expect(hidden.headers.get("cache-control")).toContain("max-age=300");

    setProfile(null);
    expect((await call("nobody.svg")).status).toBe(404);
  });

  it("does not touch the database for a malformed username", async () => {
    const mock = setProfile({ id: "p4", moderation_status: "approved" });

    const response = await call("..%2F..%2Fetc.svg");
    expect(response.status).toBe(404);
    expect(mock.calls).toHaveLength(0);
  });
});
