import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));
vi.mock("@/lib/db/email-recipients", () => ({
  loadEmailRecipient: vi.fn(async () => ({
    email: "olena@example.com",
    locale: "uk",
    name: "Olena",
    emailConfirmed: true,
  })),
}));
vi.mock("@/lib/email/resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/resend")>();
  return {
    ...actual,
    sendEmail: vi.fn(async () => ({ sent: true, id: "re_1" })),
    cancelScheduledEmail: vi.fn(async () => true),
  };
});

import { loadEmailRecipient } from "@/lib/db/email-recipients";
import {
  applyConversationAction,
  cancelMessageEmails,
  deleteMessage,
  editMessage,
  runMessageDigests,
  searchMessages,
  getConversationMessage,
  getConversationView,
  getMessagePermission,
  getMessagingSettings,
  getMessagingSummary,
  getMyCompanyConversationIds,
  getTeamConversationIds,
  listConversationMessages,
  listConversations,
  listMessageBlocks,
  listMessagingRestrictions,
  listMessagingScopes,
  markConversationRead,
  MESSAGE_EMAIL_DELAY_MS,
  removeMessageBlock,
  runMessagesHousekeeping,
  saveMessagingSettings,
  scheduleMessageEmails,
  sendMessage,
  setMessagingRestriction,
  startConversation,
  turnOffMessageEmails,
} from "@/lib/db/messages";
import { cancelScheduledEmail, sendEmail } from "@/lib/email/resend";
import { EMPTY_MESSAGING_SUMMARY } from "@/lib/messages";
import type { ConversationAction } from "@/lib/validation/messages";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";

type Rpc = (fn: string, args?: unknown) => QueryResult;

function client(rpc: Rpc, resolve: () => QueryResult = () => ({})) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const mock = createSupabaseMock({
    user: null,
    resolve,
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return rpc(fn, args);
    },
  });
  return { supabase: mock.client as never, calls, mock };
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("reading", () => {
  it("lists conversations with the box and the company", async () => {
    const { supabase, calls } = client(() => ({
      data: [{ id: ID, kind: "direct", side: "self", state: "open", last_message_at: "2026-10-10T10:00:00Z" }, { nope: 1 }],
    }));
    const rows = await listConversations(supabase, { box: "requests", companyId: COMPANY, before: "x" });
    expect(rows).toHaveLength(1);
    expect(calls[0]).toEqual({
      fn: "my_conversations",
      args: { p_box: "requests", p_company_id: COMPANY, p_before: "x", p_limit: 30 },
    });
  });

  it("returns nothing on an error", async () => {
    const { supabase } = client(() => ({ error: { message: "no function" } }));
    expect(await listConversations(supabase)).toEqual([]);
    expect(await listConversationMessages(supabase, ID)).toEqual([]);
    expect(await getConversationView(supabase, ID)).toBeNull();
    expect(await getMessagingSummary(supabase)).toEqual(EMPTY_MESSAGING_SUMMARY);
    expect(await getMessagePermission(supabase, ID)).toBeNull();
    expect(await listMessageBlocks(supabase)).toEqual([]);
    expect(await listMessagingRestrictions(supabase)).toEqual([]);
    expect((await getTeamConversationIds(supabase, COMPANY, [ID])).size).toBe(0);
    expect((await getMyCompanyConversationIds(supabase, [COMPANY])).size).toBe(0);
  });

  it("pages messages before or after a sequence number", async () => {
    const { supabase, calls } = client(() => ({ data: [{ id: "m1", seq: 1, created_at: "2026-10-10T10:00:00Z" }] }));
    expect(await listConversationMessages(supabase, ID, { before: 40 })).toHaveLength(1);
    expect(calls[0].args).toEqual({ p_conversation_id: ID, p_before_seq: 40, p_after_seq: null, p_limit: 50 });
  });

  it("reads one message with its conversation", async () => {
    const { supabase } = client(() => ({ data: [{ id: "m1", seq: 3, conversation_id: ID, created_at: "x" }] }));
    expect(await getConversationMessage(supabase, "m1")).toMatchObject({ id: "m1", seq: 3, conversationId: ID });
    const empty = client(() => ({ data: [] }));
    expect(await getConversationMessage(empty.supabase, "m1")).toBeNull();
  });

  it("reads the view", async () => {
    const { supabase } = client(() => ({ data: { status: "ok", conversation: { id: ID, kind: "direct" } } }));
    expect((await getConversationView(supabase, ID))?.id).toBe(ID);
  });

  it("answers the permission, 'exists' with the conversation", async () => {
    const ok = client(() => ({ data: { status: "ok" } }));
    expect(await getMessagePermission(ok.supabase, ID)).toEqual({ status: "ok", conversationId: null });
    expect(ok.calls[0].args).toEqual({ p_recipient_user_id: ID, p_company_id: null });
    const exists = client(() => ({ data: { status: "exists", conversation_id: OTHER } }));
    expect(await getMessagePermission(exists.supabase, ID, COMPANY)).toEqual({ status: "exists", conversationId: OTHER });
    const refused = client(() => ({ data: { status: "not_accepting" } }));
    expect((await getMessagePermission(refused.supabase, ID))?.status).toBe("not_accepting");
  });

  it("maps team and own conversations", async () => {
    const team = client(() => ({ data: [{ user_id: ID, conversation_id: OTHER }] }));
    expect((await getTeamConversationIds(team.supabase, COMPANY, [ID, ID])).get(ID)).toBe(OTHER);
    expect(team.calls[0].args).toEqual({ p_company_id: COMPANY, p_user_ids: [ID] });
    const mine = client(() => ({ data: [{ company_id: COMPANY, conversation_id: OTHER }] }));
    expect((await getMyCompanyConversationIds(mine.supabase, [COMPANY])).get(COMPANY)).toBe(OTHER);
    expect((await getTeamConversationIds(team.supabase, COMPANY, [])).size).toBe(0);
  });

  it("lists the scopes: mine first, then the companies by name", async () => {
    const { supabase } = client(
      () => ({}),
      () => ({ data: [{ company: { id: COMPANY, name: "Zeta" } }, { company: [{ id: OTHER, name: "Acme" }] }, { company: null }] }),
    );
    const scopes = await listMessagingScopes(
      supabase,
      ID,
      { ...EMPTY_MESSAGING_SUMMARY, personalUnread: 1, requests: 2, companies: [{ companyId: COMPANY, unread: 4 }] },
      "Mine",
    );
    expect(scopes).toEqual([
      { id: null, name: "Mine", unread: 3 },
      { id: OTHER, name: "Acme", unread: 0 },
      { id: COMPANY, name: "Zeta", unread: 4 },
    ]);
  });
});

describe("writing", () => {
  it("starts a conversation", async () => {
    const { supabase, calls } = client(() => ({
      data: { status: "ok", conversation_id: ID, message_id: "m1", seq: 5, created: true, scam: true },
    }));
    const outcome = await startConversation(supabase, { recipientUserId: OTHER, body: "Hi", companyId: COMPANY });
    expect(outcome).toEqual({ ok: true, conversationId: ID, messageId: "m1", seq: 5, created: true, duplicate: false, scam: true });
    expect(calls[0]).toEqual({
      fn: "start_conversation",
      args: { p_recipient_user_id: OTHER, p_body: "Hi", p_client_id: null, p_company_id: COMPANY, p_application_id: null },
    });
  });

  it("passes a refusal and its categories on", async () => {
    const { supabase } = client(() => ({ data: { status: "moderation_blocked", categories: ["hate", 3] } }));
    expect(await sendMessage(supabase, ID, "x")).toEqual({ ok: false, code: "moderation_blocked", categories: ["hate"] });
  });

  it("treats an error or a strange answer as 'failed'", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = client(() => ({ error: { message: "boom" } }));
    expect(await sendMessage(broken.supabase, ID, "x")).toEqual({ ok: false, code: "failed", categories: [] });
    const strange = client(() => ({ data: { status: "ok" } }));
    expect(await sendMessage(strange.supabase, ID, "x")).toEqual({ ok: false, code: "failed", categories: [] });
    const unknown = client(() => ({ data: { status: "who_knows" } }));
    expect((await sendMessage(unknown.supabase, ID, "x")).ok).toBe(false);
    spy.mockRestore();
  });

  it("sends with the client id", async () => {
    const { supabase, calls } = client(() => ({
      data: { status: "ok", conversation_id: ID, message_id: "m2", seq: 6, duplicate: true },
    }));
    expect(await sendMessage(supabase, ID, "Hello", OTHER)).toMatchObject({ ok: true, duplicate: true, created: false });
    expect(calls[0].args).toEqual({ p_conversation_id: ID, p_body: "Hello", p_client_id: OTHER });
  });

  it("marks read and returns the emails to cancel", async () => {
    const { supabase, calls } = client(() => ({
      data: { status: "ok", last_read_seq: 9, cancel_email_ids: ["re_1", "", 3] },
    }));
    expect(await markConversationRead(supabase, ID, 9)).toEqual({ lastReadSeq: 9, cancelEmailIds: ["re_1"] });
    expect(calls[0].args).toEqual({ p_conversation_id: ID, p_seq: 9 });
    const missing = client(() => ({ data: { status: "not_found" } }));
    expect(await markConversationRead(missing.supabase, ID)).toBeNull();
  });

  it.each<[ConversationAction, string, Record<string, unknown>]>([
    [{ action: "accept" }, "accept_message_request", { p_conversation_id: ID }],
    [{ action: "archive", value: true }, "set_conversation_state", { p_conversation_id: ID, p_archived: true }],
    [{ action: "mute", value: false }, "set_conversation_state", { p_conversation_id: ID, p_muted: false }],
    [{ action: "clear" }, "set_conversation_state", { p_conversation_id: ID, p_clear: true }],
    [{ action: "block", value: true }, "set_conversation_block", { p_conversation_id: ID, p_blocked: true }],
  ])("%o calls %s", async (action, fn, args) => {
    const { supabase, calls } = client(() => ({ data: { status: "ok", deleted: action.action === "clear" } }));
    expect(await applyConversationAction(supabase, ID, action)).toEqual({ ok: true, deleted: action.action === "clear" });
    expect(calls[0]).toEqual({ fn, args });
  });

  it("maps the action refusals", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await applyConversationAction(client(() => ({ data: { status: "not_recipient" } })).supabase, ID, { action: "accept" })).toEqual({
      ok: false,
      code: "not_recipient",
    });
    expect(await applyConversationAction(client(() => ({ data: { status: "not_found" } })).supabase, ID, { action: "clear" })).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(await applyConversationAction(client(() => ({ error: { message: "x" } })).supabase, ID, { action: "clear" })).toEqual({
      ok: false,
      code: "failed",
    });
    spy.mockRestore();
  });
});

describe("settings and blocks", () => {
  it("reads and saves the settings", async () => {
    const read = client(() => ({
      data: { whoCanMessage: "nobody", emailNotifications: true, messageEmails: "daily", readReceipts: true },
    }));
    expect(await getMessagingSettings(read.supabase)).toEqual({
      whoCanMessage: "nobody",
      emailNotifications: true,
      messageEmails: "daily",
      readReceipts: true,
    });

    const save = client(() => ({ data: { status: "ok", settings: { whoCanMessage: "verified_companies" } } }));
    expect((await saveMessagingSettings(save.supabase, { whoCanMessage: "verified_companies" }))?.whoCanMessage).toBe("verified_companies");
    expect(save.calls[0].args).toEqual({ p_who_can_message: "verified_companies", p_email_notifications: null, p_read_receipts: null });

    const refused = client(() => ({ data: { status: "invalid" } }));
    expect(await saveMessagingSettings(refused.supabase, { readReceipts: false })).toBeNull();
  });

  it("lists and removes blocks", async () => {
    const list = client(() => ({ data: [{ id: ID, person: { userId: OTHER, username: "bob" }, created_at: "x" }] }));
    expect(await listMessageBlocks(list.supabase)).toHaveLength(1);
    expect(await removeMessageBlock(client(() => ({ data: { status: "ok" } })).supabase, ID)).toBe(true);
    expect(await removeMessageBlock(client(() => ({ data: { status: "not_found" } })).supabase, ID)).toBe(false);
  });
});

describe("emails", () => {
  function adminWith(rpc: Rpc) {
    const created = client(rpc);
    holder.admin = created.mock;
    return created;
  }

  it("schedules one email per job, 10 minutes ahead, and keeps Resend's id", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const now = Date.UTC(2026, 9, 10, 10, 0, 0);
    const { calls } = adminWith((fn) =>
      fn === "queue_message_emails"
        ? {
            data: [
              { job_id: 7, recipient_user_id: OTHER, conversation_id: ID, sender_name: "Acme", as_company: true, is_request: false },
            ],
          }
        : {},
    );

    await scheduleMessageEmails("m1", now);

    expect(calls[0]).toEqual({ fn: "queue_message_emails", args: { p_message_id: "m1" } });
    expect(sendEmail).toHaveBeenCalledOnce();
    const sent = vi.mocked(sendEmail).mock.calls[0][0];
    expect(sent.to).toBe("olena@example.com");
    expect(sent.scheduledAt).toBe(new Date(now + MESSAGE_EMAIL_DELAY_MS).toISOString());
    expect(sent.subject).toContain("Acme");
    expect(sent.html).toContain(`/uk/messages/${ID}`);
    expect(sent.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(calls[1]).toEqual({ fn: "set_message_email_job", args: { p_job_id: 7, p_resend_id: "re_1" } });
    vi.unstubAllEnvs();
  });

  it("frees the job when the address is not confirmed or sending fails", async () => {
    vi.mocked(loadEmailRecipient).mockResolvedValueOnce({ email: "x@y.z", locale: "en", name: "", emailConfirmed: false });
    const { calls } = adminWith((fn) =>
      fn === "queue_message_emails"
        ? { data: [{ job_id: "8", recipient_user_id: OTHER, conversation_id: ID, sender_name: null, as_company: false, is_request: true }] }
        : {},
    );
    await scheduleMessageEmails("m1");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(calls[1]).toEqual({ fn: "set_message_email_job", args: { p_job_id: 8, p_resend_id: null } });

    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: false, error: "status_500" });
    const second = adminWith((fn) =>
      fn === "queue_message_emails"
        ? { data: [{ job_id: 9, recipient_user_id: OTHER, conversation_id: ID, sender_name: "Bob", as_company: false, is_request: false }] }
        : {},
    );
    await scheduleMessageEmails("m2");
    expect(second.calls[1]).toEqual({ fn: "set_message_email_job", args: { p_job_id: 9, p_resend_id: null } });
  });

  it("does nothing without the service key, and never throws", async () => {
    holder.admin = null;
    await expect(scheduleMessageEmails("m1")).resolves.toBeUndefined();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    adminWith(() => ({ error: { message: "no function" } }));
    await expect(scheduleMessageEmails("m1")).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("cancels at Resend", async () => {
    await cancelMessageEmails(["re_1", "re_2"]);
    expect(cancelScheduledEmail).toHaveBeenCalledTimes(2);
  });

  it("turns the emails off with the service key", async () => {
    expect(await turnOffMessageEmails(ID)).toBe(false);
    const { calls } = adminWith(() => ({}));
    expect(await turnOffMessageEmails(ID)).toBe(true);
    expect(calls[0]).toEqual({ fn: "turn_off_message_emails", args: { p_user_id: ID } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    adminWith(() => ({ error: { message: "x" } }));
    expect(await turnOffMessageEmails(ID)).toBe(false);
    spy.mockRestore();
  });
});

describe("cron and moderation", () => {
  it("runs the housekeeping and counts", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await runMessagesHousekeeping()).toEqual({});
    warn.mockRestore();
    holder.admin = client(() => ({ data: { conversations: 2, emailJobs: "3" } })).mock;
    expect(await runMessagesHousekeeping()).toEqual({ conversations: 2, emailJobs: 3 });
    holder.admin = client(() => ({ error: { message: "boom" } })).mock;
    await expect(runMessagesHousekeeping()).rejects.toThrow("boom");
  });

  it("limits and lifts with the admin's session", async () => {
    const ok = client(() => ({ data: { status: "ok" } }));
    expect(await setMessagingRestriction(ok.supabase, { userId: ID, scope: "all", days: 30, note: "Spam", reportId: OTHER })).toEqual({ ok: true });
    expect(ok.calls[0].args).toEqual({ p_user_id: ID, p_scope: "all", p_days: 30, p_note: "Spam", p_report_id: OTHER });
    const forbidden = client(() => ({ error: { code: "42501", message: "only platform admins" } }));
    expect(await setMessagingRestriction(forbidden.supabase, { userId: ID, scope: null })).toMatchObject({ ok: false, status: 403 });
  });

  it("lists the restrictions", async () => {
    const { supabase } = client(() => ({
      data: [
        { user_id: ID, person: { userId: ID, username: "spam" }, scope: "all", until: null, reason: "x", source: "system", created_at: "t" },
        { nope: 1 },
      ],
    }));
    expect(await listMessagingRestrictions(supabase)).toEqual([
      { userId: ID, person: expect.objectContaining({ username: "spam" }), scope: "all", until: null, reason: "x", source: "system", createdAt: "t" },
    ]);
  });
});

describe("editing, deleting and search (13.3)", () => {
  it("edits one's own message and says why not", async () => {
    const ok = client(() => ({ data: { status: "ok", changed: true, message_id: "m1" } }));
    expect(await editMessage(ok.supabase, "m1", "New text")).toEqual({ ok: true, changed: true });
    expect(ok.calls[0]).toEqual({ fn: "edit_message", args: { p_message_id: "m1", p_body: "New text" } });

    const late = client(() => ({ data: { status: "edit_window_passed" } }));
    expect(await editMessage(late.supabase, "m1", "x")).toEqual({ ok: false, code: "edit_window_passed", categories: [] });

    const blocked = client(() => ({ data: { status: "moderation_blocked", categories: ["hate", 3] } }));
    expect(await editMessage(blocked.supabase, "m1", "x")).toEqual({ ok: false, code: "moderation_blocked", categories: ["hate"] });

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = client(() => ({ error: { message: "no function" } }));
    expect(await editMessage(broken.supabase, "m1", "x")).toEqual({ ok: false, code: "failed", categories: [] });
    spy.mockRestore();
  });

  it("deletes one's own message and hands back the emails to cancel", async () => {
    const ok = client(() => ({ data: { status: "ok", changed: true, cancel_email_ids: ["re_1", "", 4] } }));
    expect(await deleteMessage(ok.supabase, "m1")).toEqual({ ok: true, changed: true, cancelEmailIds: ["re_1"] });
    expect(ok.calls[0]).toEqual({ fn: "delete_message", args: { p_message_id: "m1" } });

    expect(await deleteMessage(client(() => ({ data: { status: "not_found" } })).supabase, "m1")).toEqual({ ok: false, code: "not_found" });
    expect(await deleteMessage(client(() => ({ data: { status: "unauthorized" } })).supabase, "m1")).toEqual({
      ok: false,
      code: "unauthorized",
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await deleteMessage(client(() => ({ error: { message: "x" } })).supabase, "m1")).toEqual({ ok: false, code: "failed" });
    spy.mockRestore();
  });

  it("searches the caller's messages or a team inbox", async () => {
    const { supabase, calls } = client(() => ({
      data: [
        { conversation_id: ID, kind: "direct", side: "self", message_id: null, created_at: "t" },
        { conversation_id: ID, kind: "direct", side: "self", message_id: "m3", seq: 3, snippet: "needle", from_my_side: false, created_at: "t" },
        { nope: true },
      ],
    }));
    const results = await searchMessages(supabase, "needle", COMPANY);
    expect(calls[0]).toEqual({ fn: "search_messages", args: { p_query: "needle", p_company_id: COMPANY, p_limit: 30 } });
    expect(results.map((result) => result.messageId)).toEqual([null, "m3"]);

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await searchMessages(client(() => ({ error: { message: "x" } })).supabase, "needle")).toEqual([]);
    spy.mockRestore();
  });
});

describe("the daily message email (13.3)", () => {
  function adminWith(rpc: Rpc) {
    const created = client(rpc);
    holder.admin = created.mock;
    return created;
  }

  const row = (userId: string, patch: Record<string, unknown> = {}) => ({
    user_id: userId,
    conversations: 3,
    messages: 5,
    requests: 1,
    senders: ["Olena", "Acme", ""],
    ...patch,
  });

  it("emails each person once, with counts and names, and marks only those sent", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.mocked(sendEmail).mockResolvedValueOnce({ sent: true, id: "re_1" }).mockResolvedValueOnce({ sent: false, error: "status_500" });
    const { calls } = adminWith((fn) => (fn === "message_digest_candidates" ? { data: [row(ID), row(OTHER)] } : { data: 1 }));

    expect(await runMessageDigests()).toEqual({ candidates: 2, sent: 1, failed: 1 });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    const first = vi.mocked(sendEmail).mock.calls[0][0];
    expect(first.to).toBe("olena@example.com");
    expect(first.subject).toBe("5 нових повідомлень на Search Talent");
    expect(first.text).toContain("Olena, Acme");
    expect(first.html).toContain("/uk/messages");
    expect(first.headers?.["List-Unsubscribe"]).toContain("/api/email-unsubscribe?k=messages");
    expect(calls.at(-1)).toEqual({ fn: "mark_message_digests_sent", args: { p_user_ids: [ID] } });
    vi.unstubAllEnvs();
  });

  it("skips an unconfirmed address but moves its mark, and survives a failure", async () => {
    vi.mocked(loadEmailRecipient).mockResolvedValueOnce({ email: "x@y.z", locale: "en", name: "", emailConfirmed: false });
    const { calls } = adminWith((fn) => (fn === "message_digest_candidates" ? { data: [row(ID)] } : { data: 1 }));
    expect(await runMessageDigests()).toEqual({ candidates: 1, sent: 0, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(calls.at(-1)).toEqual({ fn: "mark_message_digests_sent", args: { p_user_ids: [ID] } });

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(loadEmailRecipient).mockRejectedValueOnce(new Error("auth down"));
    const second = adminWith((fn) => (fn === "message_digest_candidates" ? { data: [row(ID)] } : { data: 1 }));
    expect(await runMessageDigests()).toEqual({ candidates: 1, sent: 0, failed: 1 });
    expect(second.calls.some((call) => call.fn === "mark_message_digests_sent")).toBe(false);
    spy.mockRestore();
  });

  it("does nothing without the service key and throws when the database fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    holder.admin = null;
    expect(await runMessageDigests()).toEqual({ candidates: 0, sent: 0, failed: 0 });
    warn.mockRestore();
    adminWith(() => ({ error: { message: "no function" } }));
    await expect(runMessageDigests()).rejects.toThrow("no function");
  });
});
