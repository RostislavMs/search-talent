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

const adminClient = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient.current,
}));

beforeEach(async () => {
  vi.resetModules();
  adminClient.current = null;
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

// The limiter talks to Postgres through the service-role client only; each
// test installs the stub as that client.
function useStubAdminClient(result: StubRpcResult | Error) {
  const client = {
    rpc: vi.fn(async () => {
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }),
  };
  adminClient.current = client;
  return client;
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
    const client = useStubAdminClient({ data: 0, error: null });

    const result = await dbRateLimit("vote:user-1", 20, 60_000);
    expect(result).toBeNull();
    expect(client.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "vote:user-1",
      p_limit: 20,
      p_window_ms: 60_000,
    });
  });

  it("returns a 429 with Retry-After when the RPC reports a positive wait", async () => {
    const dbRateLimit = await loadDbRateLimit();
    useStubAdminClient({ data: 45, error: null });

    const result = (await dbRateLimit("vote:user-1", 20, 60_000)) as unknown as {
      status: number;
      headers: Record<string, string>;
    } | null;

    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
    expect(result?.headers["Retry-After"]).toBe("45");
  });

  it("falls back to the in-memory limiter when the RPC errors out", async () => {
    const dbRateLimit = await loadDbRateLimit();
    useStubAdminClient({
      data: null,
      error: { message: "function check_rate_limit does not exist" },
    });

    const key = `fallback:${Math.random()}`;
    expect(await dbRateLimit(key, 1, 60_000)).toBeNull();
    expect(await dbRateLimit(key, 1, 60_000)).not.toBeNull();
  });

  it("falls back when the RPC throws", async () => {
    const dbRateLimit = await loadDbRateLimit();
    useStubAdminClient(new Error("network"));

    const key = `throw:${Math.random()}`;
    expect(await dbRateLimit(key, 1, 60_000)).toBeNull();
    expect(await dbRateLimit(key, 1, 60_000)).not.toBeNull();
  });

  it("uses the in-memory limiter when there is no service key", async () => {
    const dbRateLimit = await loadDbRateLimit();

    const key = `no-admin:${Math.random()}`;
    expect(await dbRateLimit(key, 1, 60_000)).toBeNull();
    expect(await dbRateLimit(key, 1, 60_000)).not.toBeNull();
  });
});
