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

async function loadDbRateLimit() {
  const mod = await import("@/lib/rate-limit");
  return mod.dbRateLimit;
}

type StubRpcResult = { data?: unknown; error?: unknown };

function makeStubClient(result: StubRpcResult | Error) {
  return {
    rpc: vi.fn(async () => {
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }),
  } as unknown as Parameters<
    Awaited<ReturnType<typeof loadDbRateLimit>>
  >[0];
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

describe("dbRateLimit", () => {
  it("returns null when the RPC reports the call is allowed (returns 0)", async () => {
    const dbRateLimit = await loadDbRateLimit();
    const client = makeStubClient({ data: 0, error: null });

    const result = await dbRateLimit(client, "vote:user-1", 20, 60_000);
    expect(result).toBeNull();
  });

  it("returns a 429 with Retry-After when the RPC reports a positive wait", async () => {
    const dbRateLimit = await loadDbRateLimit();
    const client = makeStubClient({ data: 45, error: null });

    const result = (await dbRateLimit(
      client,
      "vote:user-1",
      20,
      60_000,
    )) as unknown as {
      status: number;
      headers: Record<string, string>;
    } | null;

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    expect(result?.headers["Retry-After"]).toBe("45");
  });

  it("falls back to the in-memory limiter when the RPC errors out", async () => {
    const dbRateLimit = await loadDbRateLimit();
    const client = makeStubClient({
      data: null,
      error: { message: "function check_rate_limit does not exist" },
    });

    const key = `fallback:${Math.random()}`;
    expect(await dbRateLimit(client, key, 1, 60_000)).toBeNull();
    expect(await dbRateLimit(client, key, 1, 60_000)).not.toBeNull();
  });

  it("falls back when the RPC throws", async () => {
    const dbRateLimit = await loadDbRateLimit();
    const client = makeStubClient(new Error("network"));

    const key = `throw:${Math.random()}`;
    expect(await dbRateLimit(client, key, 1, 60_000)).toBeNull();
    expect(await dbRateLimit(client, key, 1, 60_000)).not.toBeNull();
  });
});
