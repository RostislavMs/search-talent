import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));

import {
  claimFollowerEmail,
  getNotificationPreferences,
  saveNotificationPreferences,
  turnOffEmails,
} from "@/lib/db/email-preferences";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/messages";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function client(rpc: (fn: string, args?: unknown) => QueryResult) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const mock = createSupabaseMock({
    user: null,
    resolve: () => ({}),
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

describe("email preferences", () => {
  it("reads the choices, with the defaults on an error", async () => {
    const read = client(() => ({ data: { messageEmails: "daily", followerEmails: false } }));
    expect(await getNotificationPreferences(read.supabase)).toEqual({ messageEmails: "daily", followerEmails: false });
    expect(read.calls[0].fn).toBe("my_notification_preferences");
    expect(await getNotificationPreferences(client(() => ({ error: { message: "x" } })).supabase)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES,
    );
  });

  it("saves either choice and hands back the emails to cancel", async () => {
    const save = client(() => ({
      data: { status: "ok", preferences: { messageEmails: "off", followerEmails: true }, cancel_email_ids: ["re_1", null] },
    }));
    expect(await saveNotificationPreferences(save.supabase, { messageEmails: "off" })).toEqual({
      preferences: { messageEmails: "off", followerEmails: true },
      cancelEmailIds: ["re_1"],
    });
    expect(save.calls[0]).toEqual({
      fn: "save_notification_preferences",
      args: { p_message_emails: "off", p_follower_emails: null },
    });

    const followers = client(() => ({ data: { status: "ok", preferences: { followerEmails: false } } }));
    expect((await saveNotificationPreferences(followers.supabase, { followerEmails: false }))?.cancelEmailIds).toEqual([]);
    expect(followers.calls[0].args).toEqual({ p_message_emails: null, p_follower_emails: false });

    expect(await saveNotificationPreferences(client(() => ({ data: { status: "invalid" } })).supabase, {})).toBeNull();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await saveNotificationPreferences(client(() => ({ error: { message: "x" } })).supabase, {})).toBeNull();
    spy.mockRestore();
  });

  it("turns one kind of email off with the service key", async () => {
    expect(await turnOffEmails("followers", ID)).toBe(false);

    const messages = client(() => ({}));
    holder.admin = messages.mock;
    expect(await turnOffEmails("messages", ID)).toBe(true);
    expect(messages.calls[0]).toEqual({ fn: "turn_off_message_emails", args: { p_user_id: ID } });

    const followers = client(() => ({}));
    holder.admin = followers.mock;
    expect(await turnOffEmails("followers", ID)).toBe(true);
    expect(followers.calls[0]).toEqual({ fn: "turn_off_follower_emails", args: { p_user_id: ID } });

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    holder.admin = client(() => ({ error: { message: "x" } })).mock;
    expect(await turnOffEmails("followers", ID)).toBe(false);
    spy.mockRestore();
  });

  it("asks the database whether a follower email may go", async () => {
    const yes = client(() => ({ data: true }));
    expect(await claimFollowerEmail(yes.supabase, ID, OTHER)).toBe(true);
    expect(yes.calls[0]).toEqual({ fn: "claim_follower_email", args: { p_follower_user_id: ID, p_following_user_id: OTHER } });
    expect(await claimFollowerEmail(client(() => ({ data: false })).supabase, ID, OTHER)).toBe(false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await claimFollowerEmail(client(() => ({ error: { message: "x" } })).supabase, ID, OTHER)).toBe(false);
    spy.mockRestore();
  });
});
