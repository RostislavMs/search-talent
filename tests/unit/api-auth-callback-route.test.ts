import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult } from "./helpers/supabase-mock";

type AuthResult = { data: { user: { id: string } | null }; error: unknown };

const { holder } = vi.hoisted(() => ({
  holder: {
    client: null as Record<string, unknown> | null,
    exchange: vi.fn(),
    verifyOtp: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.client) }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "uk") }));

import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as continueRoute } from "@/app/api/auth/continue/route";

const USER_ID = "33333333-3333-4333-8333-333333333333";

/**
 * `onboarding`: what reading `user_onboarding` returns — a row, no row, or an
 * error (the migration is not applied yet).
 */
function setClient(options: {
  user?: { id: string } | null;
  exchange?: AuthResult;
  verify?: AuthResult;
  onboarding?: QueryResult;
}) {
  const mock = createSupabaseMock({
    user: options.user ?? null,
    resolve: (call: QueryCall) =>
      call.table === "user_onboarding" ? (options.onboarding ?? { data: null }) : {},
  });
  holder.exchange.mockResolvedValue(options.exchange ?? { data: { user: null }, error: "bad" });
  holder.verifyOtp.mockResolvedValue(options.verify ?? { data: { user: null }, error: "bad" });
  holder.client = {
    ...mock.client,
    auth: {
      ...mock.client.auth,
      exchangeCodeForSession: holder.exchange,
      verifyOtp: holder.verifyOtp,
    },
  };
}

const signedIn: AuthResult = { data: { user: { id: USER_ID } }, error: null };

async function location(response: Response) {
  expect(response.status).toBe(307);
  const url = new URL(response.headers.get("location") ?? "");
  return `${url.pathname}${url.search}`;
}

afterEach(() => {
  holder.client = null;
  vi.clearAllMocks();
});

describe("GET /api/auth/callback", () => {
  it("sends a newcomer to the onboarding after OAuth", async () => {
    setClient({ exchange: signedIn, onboarding: { data: null } });
    const response = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=abc&locale=en"),
    );
    expect(holder.exchange).toHaveBeenCalledWith("abc");
    expect(await location(response)).toBe("/en/onboarding");
  });

  it("sends someone who finished the onboarding to My Space", async () => {
    setClient({
      exchange: signedIn,
      onboarding: { data: { completed_at: "2026-09-01T00:00:00Z", link_shared_at: null } },
    });
    const response = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=abc"),
    );
    expect(await location(response)).toBe("/uk/my-space");
  });

  it("does not force the onboarding while its table is missing", async () => {
    setClient({ exchange: signedIn, onboarding: { error: { message: "relation does not exist" } } });
    const response = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=abc"),
    );
    expect(await location(response)).toBe("/uk/my-space");
  });

  it("honours a safe next and ignores an unsafe one", async () => {
    setClient({ exchange: signedIn });
    const safe = await callback(
      new Request(
        "https://searchtalent.dev/api/auth/callback?code=abc&next=%2Fen%2Fprojects%2Fnew%3Fkind%3Dcode",
      ),
    );
    expect(await location(safe)).toBe("/en/projects/new?kind=code");

    setClient({ exchange: signedIn, onboarding: { data: null } });
    const unsafe = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=abc&next=https://evil.com"),
    );
    expect(await location(unsafe)).toBe("/uk/onboarding");
  });

  it("confirms a sign-up from another device with token_hash", async () => {
    setClient({ verify: signedIn });
    const response = await callback(
      new Request(
        "https://searchtalent.dev/api/auth/callback?token_hash=th&type=signup&flow=signup&locale=en",
      ),
    );
    expect(holder.verifyOtp).toHaveBeenCalledWith({ token_hash: "th", type: "signup" });
    expect(await location(response)).toBe("/en/onboarding");
  });

  it("ignores an unknown token type", async () => {
    setClient({ verify: signedIn });
    const response = await callback(
      new Request(
        "https://searchtalent.dev/api/auth/callback?token_hash=th&type=recovery&flow=signup",
      ),
    );
    expect(holder.verifyOtp).not.toHaveBeenCalled();
    expect(await location(response)).toBe("/uk/verify?status=expired");
  });

  it("tells a new account its email is confirmed when the session is missing", async () => {
    setClient({});
    const response = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=abc&flow=signup&locale=en"),
    );
    expect(await location(response)).toBe("/en/verify?status=confirmed");
  });

  it("reports an expired confirmation link", async () => {
    setClient({});
    const response = await callback(
      new Request(
        "https://searchtalent.dev/api/auth/callback?error=access_denied&error_code=otp_expired&flow=signup",
      ),
    );
    expect(await location(response)).toBe("/uk/verify?status=expired");
  });

  it("sends a failed OAuth back to login with the error and next", async () => {
    setClient({});
    const withoutNext = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=bad&locale=en"),
    );
    expect(await location(withoutNext)).toBe("/en/login?error=oauth");

    setClient({});
    const withNext = await callback(
      new Request("https://searchtalent.dev/api/auth/callback?code=bad&next=%2Fuk%2Fmy-space"),
    );
    expect(await location(withNext)).toBe("/uk/login?next=%2Fuk%2Fmy-space&error=oauth");
  });
});

describe("GET /api/auth/continue", () => {
  it("sends a signed-out visitor back to login, keeping next", async () => {
    setClient({ user: null });
    const response = await continueRoute(
      new Request("https://searchtalent.dev/api/auth/continue?locale=en&next=%2Fen%2Fmy-space"),
    );
    expect(await location(response)).toBe("/en/login?next=%2Fen%2Fmy-space");
  });

  it("applies next, then the onboarding rule", async () => {
    setClient({ user: { id: USER_ID }, onboarding: { data: null } });
    const withNext = await continueRoute(
      new Request("https://searchtalent.dev/api/auth/continue?next=%2Fen%2Fu%2Folena"),
    );
    expect(await location(withNext)).toBe("/en/u/olena");

    setClient({ user: { id: USER_ID }, onboarding: { data: null } });
    const newcomer = await continueRoute(
      new Request("https://searchtalent.dev/api/auth/continue?locale=en"),
    );
    expect(await location(newcomer)).toBe("/en/onboarding");

    setClient({
      user: { id: USER_ID },
      onboarding: { data: { completed_at: "2026-09-01T00:00:00Z", link_shared_at: null } },
    });
    const returning = await continueRoute(
      new Request("https://searchtalent.dev/api/auth/continue"),
    );
    expect(await location(returning)).toBe("/uk/my-space");
  });
});
