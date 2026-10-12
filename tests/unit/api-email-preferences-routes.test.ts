import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null, rpcCalls: [] as Array<{ fn: string; args: unknown }> },
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((callback: () => unknown) => void callback()) };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/messages")>();
  return { ...actual, cancelMessageEmails: vi.fn(async () => undefined) };
});
vi.mock("@/lib/db/email-preferences", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/email-preferences")>();
  return { ...actual, turnOffEmails: vi.fn(async () => true) };
});

import { GET, PATCH } from "@/app/api/email-preferences/route";
import { POST as UNSUBSCRIBE } from "@/app/api/email-unsubscribe/route";
import { POST as OLD_UNSUBSCRIBE } from "@/app/api/messages/email-unsubscribe/route";
import { turnOffEmails } from "@/lib/db/email-preferences";
import { cancelMessageEmails } from "@/lib/db/messages";
import { buildEmailOneClickUrl, emailUnsubscribeToken, oneClickUnsubscribeHeaders } from "@/lib/email-unsubscribe-token";
import { buildMessageEmailOneClickUrl, messageEmailUnsubscribeToken } from "@/lib/message-email-token";
import { rateLimit } from "@/lib/rate-limit";

const USER = "11111111-1111-4111-8111-111111111111";
const signedIn: MockUser = { id: USER, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, rpc: (fn: string, args: unknown) => QueryResult = () => ({})) {
  holder.rpcCalls = [];
  holder.mock = createSupabaseMock({
    user,
    resolve: () => ({}),
    rpc: (fn, args) => {
      holder.rpcCalls.push({ fn, args });
      return rpc(fn, args);
    },
  });
}

const patch = (body: unknown) =>
  PATCH(new Request("http://test/api/email-preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("/api/email-preferences", () => {
  it("reads the caller's choices", async () => {
    setMock(signedIn, () => ({ data: { messageEmails: "daily", followerEmails: true } }));
    expect((await (await GET()).json()).preferences).toEqual({ messageEmails: "daily", followerEmails: true });
    setMock(null);
    expect((await GET()).status).toBe(401);
  });

  it("saves a choice and cancels the message emails still waiting", async () => {
    setMock(signedIn, () => ({
      data: { status: "ok", preferences: { messageEmails: "daily", followerEmails: true }, cancel_email_ids: ["re_1"] },
    }));
    const res = await patch({ messageEmails: "daily" });
    expect(res.status).toBe(200);
    expect((await res.json()).preferences.messageEmails).toBe("daily");
    expect(holder.rpcCalls[0]).toEqual({
      fn: "save_notification_preferences",
      args: { p_message_emails: "daily", p_follower_emails: null },
    });
    expect(cancelMessageEmails).toHaveBeenCalledWith(["re_1"]);
  });

  it("refuses nonsense, a guest, and reports a failure", async () => {
    setMock(signedIn);
    expect((await patch({ messageEmails: "weekly" })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ followerEmails: "yes" })).status).toBe(400);
    setMock(signedIn, () => ({ data: { status: "invalid" } }));
    expect((await patch({ followerEmails: false })).status).toBe(500);
    setMock(null);
    expect((await patch({ followerEmails: false })).status).toBe(401);
  });
});

describe("POST /api/email-unsubscribe", () => {
  const post = (query: string) => UNSUBSCRIBE(new Request(`http://test/api/email-unsubscribe?${query}`, { method: "POST" }));

  it("turns one kind off with its own link", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const followers = emailUnsubscribeToken("followers", USER)!;
    expect((await post(`k=followers&u=${USER}&t=${followers}`)).status).toBe(200);
    expect(turnOffEmails).toHaveBeenCalledWith("followers", USER);

    const messages = emailUnsubscribeToken("messages", USER)!;
    expect((await post(`k=messages&u=${USER}&t=${messages}`)).status).toBe(200);
    expect(turnOffEmails).toHaveBeenCalledWith("messages", USER);
  });

  it("a link for one kind cannot turn off the other", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const followers = emailUnsubscribeToken("followers", USER)!;
    expect((await post(`k=messages&u=${USER}&t=${followers}`)).status).toBe(400);
    expect((await post(`k=jobs&u=${USER}&t=${followers}`)).status).toBe(400);
    expect((await post(`u=${USER}&t=${followers}`)).status).toBe(400);
    expect(turnOffEmails).not.toHaveBeenCalled();
  });

  it("503 when it cannot be done, 429 for a loop", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const token = emailUnsubscribeToken("followers", USER)!;
    vi.mocked(turnOffEmails).mockResolvedValueOnce(false);
    expect((await post(`k=followers&u=${USER}&t=${token}`)).status).toBe(503);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await post(`k=followers&u=${USER}&t=${token}`)).status).toBe(429);
  });

  it("keeps the links in emails sent before working", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const token = messageEmailUnsubscribeToken(USER)!;
    expect(token).toBe(emailUnsubscribeToken("messages", USER));
    const res = await OLD_UNSUBSCRIBE(new Request(`http://test/api/messages/email-unsubscribe?u=${USER}&t=${token}`, { method: "POST" }));
    expect(res.status).toBe(200);
    expect(turnOffEmails).toHaveBeenCalledWith("messages", USER);
  });
});

describe("one-click links", () => {
  it("need the service key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(buildEmailOneClickUrl("followers", USER)).toBeNull();
    expect(oneClickUnsubscribeHeaders("followers", USER)).toBeUndefined();
  });

  it("carry the kind, the person and the token", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const url = new URL(buildEmailOneClickUrl("followers", USER)!);
    expect(url.pathname).toBe("/api/email-unsubscribe");
    expect(url.searchParams.get("k")).toBe("followers");
    expect(url.searchParams.get("t")).toBe(emailUnsubscribeToken("followers", USER));
    expect(buildMessageEmailOneClickUrl(USER)).toContain("k=messages");
    expect(oneClickUnsubscribeHeaders("messages", USER)).toEqual({
      "List-Unsubscribe": `<${buildEmailOneClickUrl("messages", USER)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(emailUnsubscribeToken("followers", "nope")).toBeNull();
  });
});
