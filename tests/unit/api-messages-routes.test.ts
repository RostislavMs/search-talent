import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: {
    mock: null as SupabaseMock | null,
    rpcCalls: [] as Array<{ fn: string; args: unknown }>,
    viewer: { user: null as { id: string } | null, isAdmin: false },
  },
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn((callback: () => unknown) => void callback()) };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: vi.fn(async () => ({ ...holder.viewer, supabase: holder.mock!.client })),
}));
vi.mock("@/lib/db/messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/messages")>();
  return {
    ...actual,
    scheduleMessageEmails: vi.fn(async () => undefined),
    cancelMessageEmails: vi.fn(async () => undefined),
    turnOffMessageEmails: vi.fn(async () => true),
  };
});

import { POST as RESTRICT } from "@/app/api/admin/messaging-restrictions/route";
import { DELETE as UNBLOCK } from "@/app/api/messages/blocks/[id]/route";
import { GET as LIST, POST as START } from "@/app/api/messages/conversations/route";
import { GET as VIEW, PATCH } from "@/app/api/messages/conversations/[id]/route";
import { GET as PAGE, POST as SEND } from "@/app/api/messages/conversations/[id]/messages/route";
import { POST as READ } from "@/app/api/messages/conversations/[id]/read/route";
import { POST as UNSUBSCRIBE } from "@/app/api/messages/email-unsubscribe/route";
import { GET as ONE } from "@/app/api/messages/message/[id]/route";
import { GET as GET_SETTINGS, PATCH as SAVE_SETTINGS } from "@/app/api/messages/settings/route";
import { GET as SUMMARY } from "@/app/api/messages/summary/route";
import { cancelMessageEmails, scheduleMessageEmails, turnOffMessageEmails } from "@/lib/db/messages";
import { messageEmailUnsubscribeToken } from "@/lib/message-email-token";
import { rateLimit } from "@/lib/rate-limit";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
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

function json(url: string, method: string, body?: unknown) {
  return new Request(`http://test${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const sent = { status: "ok", conversation_id: CONV, message_id: "m1", seq: 4, created: true, scam: false };

afterEach(() => {
  holder.viewer = { user: null, isAdmin: false };
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/messages/conversations", () => {
  const start = (body: unknown) => START(json("/api/messages/conversations", "POST", body));

  it("401 for a guest, 400 for a bad body", async () => {
    setMock(null);
    expect((await start({ recipientUserId: OTHER, body: "Hi" })).status).toBe(401);
    setMock(signedIn);
    const bad = await start({ recipientUserId: "x", body: "Hi" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("invalid");
    expect((await start("{")).status).toBe(400);
  });

  it("starts the conversation and schedules the emails after answering", async () => {
    setMock(signedIn, () => ({ data: sent }));
    const res = await start({ recipientUserId: OTHER, body: " Hi ", companyId: OTHER });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ conversationId: CONV, messageId: "m1", seq: 4, created: true, scam: false });
    expect(holder.rpcCalls[0].args).toMatchObject({ p_recipient_user_id: OTHER, p_body: "Hi", p_company_id: OTHER });
    expect(scheduleMessageEmails).toHaveBeenCalledWith("m1");
  });

  it("does not email twice for a retry", async () => {
    setMock(signedIn, () => ({ data: { ...sent, duplicate: true } }));
    expect((await start({ recipientUserId: OTHER, body: "Hi" })).status).toBe(200);
    expect(scheduleMessageEmails).not.toHaveBeenCalled();
  });

  it.each([
    ["not_accepting", 403],
    ["rate_limited", 429],
    ["links_in_request", 400],
    ["not_found", 404],
    ["no_idea", 500],
  ])("answers the refusal %s with %i and its code", async (status, http) => {
    setMock(signedIn, () => ({ data: { status, categories: [] } }));
    const res = await start({ recipientUserId: OTHER, body: "Hi" });
    expect(res.status).toBe(http);
    expect((await res.json()).code).toBe(status === "no_idea" ? "failed" : status);
    expect(scheduleMessageEmails).not.toHaveBeenCalled();
  });

  it("stops a loop with the local limit", async () => {
    setMock(signedIn);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await start({ recipientUserId: OTHER, body: "Hi" })).status).toBe(429);
    expect(holder.rpcCalls).toHaveLength(0);
  });
});

describe("GET /api/messages/conversations", () => {
  it("lists with the query", async () => {
    setMock(signedIn, () => ({ data: [{ id: CONV, kind: "direct" }] }));
    const res = await LIST(new Request(`http://test/api/messages/conversations?box=requests&company=${OTHER}`));
    expect(res.status).toBe(200);
    expect((await res.json()).conversations).toHaveLength(1);
    expect(holder.rpcCalls[0].args).toMatchObject({ p_box: "requests", p_company_id: OTHER });
  });

  it("401 and 400", async () => {
    setMock(null);
    expect((await LIST(new Request("http://test/api/messages/conversations"))).status).toBe(401);
    setMock(signedIn);
    expect((await LIST(new Request("http://test/api/messages/conversations?box=spam"))).status).toBe(400);
  });
});

describe("one conversation", () => {
  it("shows the view and the latest messages, 404 when not the caller's", async () => {
    setMock(signedIn, (fn) =>
      fn === "conversation_view"
        ? { data: { status: "ok", conversation: { id: CONV, kind: "direct" } } }
        : { data: [{ id: "m1", seq: 1, created_at: "x" }] },
    );
    const res = await VIEW(new Request("http://test"), params(CONV));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversation.id).toBe(CONV);
    expect(body.messages).toHaveLength(1);

    setMock(signedIn, (fn) => (fn === "conversation_view" ? { data: { status: "not_found" } } : { data: [] }));
    expect((await VIEW(new Request("http://test"), params(CONV))).status).toBe(404);
    expect((await VIEW(new Request("http://test"), params("nope"))).status).toBe(400);
    setMock(null);
    expect((await VIEW(new Request("http://test"), params(CONV))).status).toBe(401);
  });

  it("applies an action", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", deleted: true } }));
    const res = await PATCH(json(`/api/messages/conversations/${CONV}`, "PATCH", { action: "clear" }), params(CONV));
    expect(await res.json()).toEqual({ ok: true, deleted: true });
    expect(holder.rpcCalls[0].fn).toBe("set_conversation_state");
  });

  it("maps the action refusals and a bad body", async () => {
    setMock(signedIn, () => ({ data: { status: "not_recipient" } }));
    expect((await PATCH(json("/x", "PATCH", { action: "accept" }), params(CONV))).status).toBe(403);
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await PATCH(json("/x", "PATCH", { action: "accept" }), params(CONV))).status).toBe(404);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setMock(signedIn, () => ({ error: { message: "boom" } }));
    expect((await PATCH(json("/x", "PATCH", { action: "accept" }), params(CONV))).status).toBe(500);
    spy.mockRestore();
    setMock(signedIn);
    expect((await PATCH(json("/x", "PATCH", { action: "archive" }), params(CONV))).status).toBe(400);
    expect((await PATCH(json("/x", "PATCH", { action: "accept" }), params("nope"))).status).toBe(400);
    setMock(null);
    expect((await PATCH(json("/x", "PATCH", { action: "accept" }), params(CONV))).status).toBe(401);
  });
});

describe("messages in a conversation", () => {
  it("sends and schedules the emails", async () => {
    setMock(signedIn, () => ({ data: sent }));
    const res = await SEND(json("/x", "POST", { body: "Hello", clientId: OTHER }), params(CONV));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ conversationId: CONV, messageId: "m1", seq: 4, scam: false });
    expect(holder.rpcCalls[0]).toEqual({
      fn: "send_message",
      args: { p_conversation_id: CONV, p_body: "Hello", p_client_id: OTHER },
    });
    expect(scheduleMessageEmails).toHaveBeenCalledWith("m1");
  });

  it("answers refusals with their code and categories", async () => {
    setMock(signedIn, () => ({ data: { status: "moderation_blocked", categories: ["hate"] } }));
    const res = await SEND(json("/x", "POST", { body: "..." }), params(CONV));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "moderation_blocked", categories: ["hate"] });
  });

  it("guards: guest, bad id, empty body, local limit", async () => {
    setMock(null);
    expect((await SEND(json("/x", "POST", { body: "Hi" }), params(CONV))).status).toBe(401);
    setMock(signedIn);
    expect((await SEND(json("/x", "POST", { body: "Hi" }), params("nope"))).status).toBe(400);
    expect((await SEND(json("/x", "POST", { body: "  " }), params(CONV))).status).toBe(400);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await SEND(json("/x", "POST", { body: "Hi" }), params(CONV))).status).toBe(429);
  });

  it("pages older messages and catches up", async () => {
    setMock(signedIn, () => ({ data: [{ id: "m1", seq: 1, created_at: "x" }] }));
    const res = await PAGE(new Request("http://test/x?before=40"), params(CONV));
    expect((await res.json()).messages).toHaveLength(1);
    expect(holder.rpcCalls[0].args).toMatchObject({ p_before_seq: 40, p_after_seq: null });
    await PAGE(new Request("http://test/x?after=12"), params(CONV));
    expect(holder.rpcCalls[1].args).toMatchObject({ p_before_seq: null, p_after_seq: 12 });
    expect((await PAGE(new Request("http://test/x?before=x"), params(CONV))).status).toBe(400);
    setMock(null);
    expect((await PAGE(new Request("http://test/x"), params(CONV))).status).toBe(401);
  });

  it("reads one message, 404 when it is not the caller's", async () => {
    setMock(signedIn, () => ({ data: [{ id: "m1", seq: 1, conversation_id: CONV, created_at: "x" }] }));
    expect((await (await ONE(new Request("http://test"), params(OTHER))).json()).message.conversationId).toBe(CONV);
    setMock(signedIn, () => ({ data: [] }));
    expect((await ONE(new Request("http://test"), params(OTHER))).status).toBe(404);
    expect((await ONE(new Request("http://test"), params("nope"))).status).toBe(400);
    setMock(null);
    expect((await ONE(new Request("http://test"), params(OTHER))).status).toBe(401);
  });
});

describe("POST /api/messages/conversations/:id/read", () => {
  it("marks read and cancels the scheduled emails after answering", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", last_read_seq: 9, cancel_email_ids: ["re_1"] } }));
    const res = await READ(json("/x", "POST", { seq: 9 }), params(CONV));
    expect(await res.json()).toEqual({ lastReadSeq: 9 });
    expect(cancelMessageEmails).toHaveBeenCalledWith(["re_1"]);
  });

  it("cancels nothing when nothing waits; 404, 400, 401", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", last_read_seq: 9, cancel_email_ids: [] } }));
    expect((await READ(json("/x", "POST", {}), params(CONV))).status).toBe(200);
    expect(cancelMessageEmails).not.toHaveBeenCalled();
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await READ(json("/x", "POST", {}), params(CONV))).status).toBe(404);
    expect((await READ(json("/x", "POST", { seq: -1 }), params(CONV))).status).toBe(400);
    expect((await READ(json("/x", "POST", {}), params("nope"))).status).toBe(400);
    setMock(null);
    expect((await READ(json("/x", "POST", {}), params(CONV))).status).toBe(401);
  });
});

describe("summary, settings, blocks", () => {
  it("gives the summary to the signed-in only", async () => {
    setMock(signedIn, () => ({ data: { hasConversations: true, unread: 2, requests: 1, companies: [] } }));
    expect((await (await SUMMARY()).json()).summary).toMatchObject({ unread: 2, requests: 1 });
    setMock(null);
    expect((await SUMMARY()).status).toBe(401);
  });

  it("reads and saves the settings", async () => {
    setMock(signedIn, (fn) =>
      fn === "my_messaging_settings"
        ? { data: { whoCanMessage: "nobody" } }
        : { data: { status: "ok", settings: { whoCanMessage: "everyone", readReceipts: false } } },
    );
    expect((await (await GET_SETTINGS()).json()).settings.whoCanMessage).toBe("nobody");
    const saved = await SAVE_SETTINGS(json("/x", "PATCH", { readReceipts: false }));
    expect((await saved.json()).settings.readReceipts).toBe(false);
    expect((await SAVE_SETTINGS(json("/x", "PATCH", {}))).status).toBe(400);
    setMock(signedIn, () => ({ data: { status: "invalid" } }));
    expect((await SAVE_SETTINGS(json("/x", "PATCH", { readReceipts: true }))).status).toBe(500);
    setMock(null);
    expect((await GET_SETTINGS()).status).toBe(401);
    expect((await SAVE_SETTINGS(json("/x", "PATCH", { readReceipts: true }))).status).toBe(401);
  });

  it("unblocks one's own blocks only", async () => {
    setMock(signedIn, () => ({ data: { status: "ok" } }));
    expect((await UNBLOCK(new Request("http://test"), params(OTHER))).status).toBe(200);
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await UNBLOCK(new Request("http://test"), params(OTHER))).status).toBe(404);
    expect((await UNBLOCK(new Request("http://test"), params("nope"))).status).toBe(400);
    setMock(null);
    expect((await UNBLOCK(new Request("http://test"), params(OTHER))).status).toBe(401);
  });
});

describe("POST /api/messages/email-unsubscribe", () => {
  it("turns the emails off with a valid link", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const token = messageEmailUnsubscribeToken(USER)!;
    const res = await UNSUBSCRIBE(new Request(`http://test/api/messages/email-unsubscribe?u=${USER}&t=${token}`, { method: "POST" }));
    expect(res.status).toBe(200);
    expect(turnOffMessageEmails).toHaveBeenCalledWith(USER);
  });

  it("refuses a forged or missing token", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    expect((await UNSUBSCRIBE(new Request(`http://test/x?u=${USER}&t=${"a".repeat(64)}`, { method: "POST" }))).status).toBe(400);
    expect((await UNSUBSCRIBE(new Request("http://test/x", { method: "POST" }))).status).toBe(400);
    expect(turnOffMessageEmails).not.toHaveBeenCalled();
  });

  it("503 when it cannot be done, 429 for a loop", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const token = messageEmailUnsubscribeToken(USER)!;
    vi.mocked(turnOffMessageEmails).mockResolvedValueOnce(false);
    expect((await UNSUBSCRIBE(new Request(`http://test/x?u=${USER}&t=${token}`, { method: "POST" }))).status).toBe(503);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await UNSUBSCRIBE(new Request(`http://test/x?u=${USER}&t=${token}`, { method: "POST" }))).status).toBe(429);
  });
});

describe("POST /api/admin/messaging-restrictions", () => {
  const restrict = (body: unknown) => RESTRICT(json("/api/admin/messaging-restrictions", "POST", body));

  it("401 and 403 for guests and non-admins", async () => {
    setMock(null);
    expect((await restrict({ userId: OTHER, scope: "all" })).status).toBe(401);
    holder.viewer = { user: { id: USER }, isAdmin: false };
    setMock(signedIn);
    expect((await restrict({ userId: OTHER, scope: "all" })).status).toBe(403);
  });

  it("limits and lifts", async () => {
    holder.viewer = { user: { id: USER }, isAdmin: true };
    setMock(signedIn, () => ({ data: { status: "ok", changed: true } }));
    expect((await restrict({ userId: OTHER, scope: "new_conversations", days: 7, reportId: CONV })).status).toBe(200);
    expect(holder.rpcCalls[0]).toEqual({
      fn: "admin_set_messaging_restriction",
      args: { p_user_id: OTHER, p_scope: "new_conversations", p_days: 7, p_note: null, p_report_id: CONV },
    });
    expect((await restrict({ userId: OTHER, scope: null })).status).toBe(200);
    expect((await restrict({ userId: OTHER, scope: "forever" })).status).toBe(400);
    setMock(signedIn, () => ({ error: { code: "22023", message: "invalid duration" } }));
    expect((await restrict({ userId: OTHER, scope: "all", days: 30 })).status).toBe(400);
  });
});
