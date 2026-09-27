import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: {
    session: null as SupabaseMock | null,
    admin: null as { rpc: ReturnType<typeof vi.fn> } | null,
    consent: null as unknown,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => holder.session!.client),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin),
}));
vi.mock("@/lib/cookie-consent-server", () => ({
  getCookieConsentFromCookies: vi.fn(async () => holder.consent),
}));

import { POST as recordView } from "@/app/api/metrics/view/route";
import { POST as recordSignupSource } from "@/app/api/metrics/signup-source/route";
import { buildAllowAllConsent, buildEssentialOnlyConsent } from "@/lib/cookie-consent";

const ID = "22222222-2222-4222-8222-222222222222";
const BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

let ipCounter = 0;

function setSession(
  user: MockUser,
  rpc: (fn: string, args?: unknown) => QueryResult = () => ({ data: true }),
) {
  holder.session = createSupabaseMock({ user, resolve: () => ({}), rpc });
}

function viewRequest(body: unknown, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return new Request("http://searchtalent.test/api/metrics/view", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "searchtalent.test",
      "user-agent": BROWSER,
      "x-forwarded-for": `10.0.0.${ipCounter}`,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  holder.session = null;
  holder.admin = null;
  holder.consent = null;
  vi.clearAllMocks();
});

describe("POST /api/metrics/view", () => {
  it("400 for a malformed payload", async () => {
    setSession(null);
    holder.admin = { rpc: vi.fn(async () => ({ data: true, error: null })) };
    const res = await recordView(viewRequest({ targetType: "poll", targetId: ID }));
    expect(res.status).toBe(400);
    expect(holder.admin.rpc).not.toHaveBeenCalled();
  });

  it("drops bots without touching the database", async () => {
    setSession(null);
    holder.admin = { rpc: vi.fn(async () => ({ data: true, error: null })) };
    const res = await recordView(
      viewRequest(
        { targetType: "profile", targetId: ID },
        { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      ),
    );
    expect(res.status).toBe(204);
    expect(holder.admin.rpc).not.toHaveBeenCalled();
  });

  it("answers 204 when there is no service key", async () => {
    setSession(null);
    const res = await recordView(viewRequest({ targetType: "profile", targetId: ID }));
    expect(res.status).toBe(204);
  });

  it("records a guest's outside view by IP and user agent, keeping only the host", async () => {
    setSession(null);
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    holder.admin = { rpc };

    const res = await recordView(
      viewRequest(
        {
          targetType: "profile",
          targetId: ID,
          referrer: "https://www.linkedin.com/in/someone?trk=secret",
        },
        { "x-forwarded-for": "203.0.113.7" },
      ),
    );

    expect(res.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("record_content_view", {
      p_target_type: "profile",
      p_target_id: ID,
      p_visitor_seed: `a:203.0.113.7|${BROWSER}`,
      p_viewer_user_id: null,
      p_source: "external",
      p_referrer_host: "linkedin.com",
    });
  });

  it("marks a view from the site itself as internal and passes the viewer", async () => {
    setSession({ id: "viewer-1" });
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    holder.admin = { rpc };

    await recordView(
      viewRequest({
        targetType: "project",
        targetId: ID,
        referrer: "http://searchtalent.test/uk/talents",
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "record_content_view",
      expect.objectContaining({
        p_visitor_seed: "u:viewer-1",
        p_viewer_user_id: "viewer-1",
        p_source: "internal",
        p_referrer_host: null,
      }),
    );
  });

  it("stays 204 when the RPC fails (migration not applied)", async () => {
    setSession(null);
    holder.admin = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "function does not exist" } })),
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await recordView(viewRequest({ targetType: "article", targetId: ID }));
    expect(res.status).toBe(204);
    warn.mockRestore();
  });
});

describe("POST /api/metrics/signup-source", () => {
  const payload = {
    referrerHost: "linkedin.com",
    utmSource: "linkedin",
    utmMedium: null,
    utmCampaign: null,
    landingPath: "/uk",
    firstSeenAgeSeconds: 600,
  };

  const request = (body: unknown) =>
    new Request("http://searchtalent.test/api/metrics/signup-source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("401 for a guest", async () => {
    setSession(null);
    holder.consent = buildAllowAllConsent();
    expect((await recordSignupSource(request(payload))).status).toBe(401);
  });

  it("400 for an invalid payload", async () => {
    setSession({ id: "u1" });
    holder.consent = buildAllowAllConsent();
    const res = await recordSignupSource(request({ ...payload, firstSeenAgeSeconds: -1 }));
    expect(res.status).toBe(400);
  });

  it("stores nothing without analytics consent", async () => {
    const rpc = vi.fn(() => ({ data: true }) as QueryResult);
    setSession({ id: "u1" }, rpc);
    holder.consent = buildEssentialOnlyConsent();

    const res = await recordSignupSource(request(payload));
    expect(await res.json()).toEqual({ recorded: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes the first touch to the RPC with consent", async () => {
    const rpc = vi.fn(() => ({ data: true }) as QueryResult);
    setSession({ id: "u1" }, rpc);
    holder.consent = buildAllowAllConsent();

    const res = await recordSignupSource(request(payload));
    expect(await res.json()).toEqual({ recorded: true });
    expect(rpc).toHaveBeenCalledWith("record_signup_source", {
      p_referrer_host: "linkedin.com",
      p_utm_source: "linkedin",
      p_utm_medium: null,
      p_utm_campaign: null,
      p_landing_path: "/uk",
      p_first_seen_age_seconds: 600,
    });
  });
});
