import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit | undefined) => ({
      kind: "next-response" as const,
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      body,
    }),
  },
}));

beforeEach(async () => {
  vi.resetModules();
});

async function loadRateLimit() {
  const mod = await import("@/lib/rate-limit");
  return mod.rateLimit;
}

describe("rateLimit", () => {
  it("allows requests up to the limit and rejects the next one", async () => {
    const rateLimit = await loadRateLimit();
    const key = `test:${Math.random()}`;

    expect(rateLimit(key, 3, 60_000)).toBeNull();
    expect(rateLimit(key, 3, 60_000)).toBeNull();
    expect(rateLimit(key, 3, 60_000)).toBeNull();

    const blocked = rateLimit(key, 3, 60_000) as unknown as {
      status: number;
      headers: Record<string, string>;
      body: { error: string };
    };

    expect(blocked).not.toBeNull();
    expect(blocked.status).toBe(429);
    expect(blocked.headers["Retry-After"]).toBeDefined();
    expect(blocked.body.error).toMatch(/Too many requests/i);
  });

  it("resets the window after it expires", async () => {
    const rateLimit = await loadRateLimit();
    const key = `test:${Math.random()}`;

    const now = Date.parse("2026-01-01T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(rateLimit(key, 1, 1_000)).toBeNull();
    expect(rateLimit(key, 1, 1_000)).not.toBeNull();

    vi.setSystemTime(now + 1_500);
    expect(rateLimit(key, 1, 1_000)).toBeNull();

    vi.useRealTimers();
  });

  it("tracks different keys independently", async () => {
    const rateLimit = await loadRateLimit();

    expect(rateLimit("a", 1, 60_000)).toBeNull();
    expect(rateLimit("b", 1, 60_000)).toBeNull();
    expect(rateLimit("a", 1, 60_000)).not.toBeNull();
    expect(rateLimit("b", 1, 60_000)).not.toBeNull();
  });
});
