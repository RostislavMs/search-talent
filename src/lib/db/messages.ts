import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEmailRecipient } from "@/lib/db/email-recipients";
import { cancelScheduledEmail, sendEmail } from "@/lib/email/resend";
import { buildNewMessageEmail } from "@/lib/email/templates";
import type { Locale } from "@/lib/i18n/config";
import { buildMessageEmailOneClickUrl } from "@/lib/message-email-token";
import {
  buildConversationPath,
  CONVERSATIONS_PAGE_SIZE,
  EMPTY_MESSAGING_SUMMARY,
  MESSAGES_PAGE_SIZE,
  MESSAGES_SETTINGS_PATH,
  normalizeBlockRow,
  normalizeConversationRow,
  normalizeConversationView,
  normalizeMessageRow,
  normalizeMessagingSettings,
  normalizeMessagingSummary,
  normalizePerson,
  toRefusalCode,
  type ChatMessage,
  type ConversationBox,
  type ConversationPreview,
  type ConversationView,
  type MessageBlock,
  type MessageRefusalCode,
  type MessagingPerson,
  type MessagingSettings,
  type MessagingSummary,
  type WhoCanMessage,
} from "@/lib/messages";
import { getSiteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConversationAction } from "@/lib/validation/messages";

/**
 * Messages live in the database (the messages migration): every read and
 * write is a SECURITY DEFINER function that checks the caller's side, so all
 * of these run with the signed-in person's own session. The service key is
 * only for the emails and the cron.
 */

/** How long an email waits for the message to be read on the site first. */
export const MESSAGE_EMAIL_DELAY_MS = 10 * 60_000;

// --- Reading -----------------------------------------------------------------------------

/** The caller's conversations (or a company's team inbox), newest first. Empty on any error. */
export async function listConversations(
  supabase: SupabaseClient,
  {
    box = "inbox",
    companyId = null,
    before = null,
    limit = CONVERSATIONS_PAGE_SIZE,
  }: { box?: ConversationBox; companyId?: string | null; before?: string | null; limit?: number } = {},
): Promise<ConversationPreview[]> {
  const { data, error } = await supabase.rpc("my_conversations", {
    p_box: box,
    p_company_id: companyId,
    p_before: before,
    p_limit: limit,
  });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeConversationRow).filter((row): row is ConversationPreview => Boolean(row));
}

/** One conversation's header, or null when it is not the caller's (or does not exist). */
export async function getConversationView(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ConversationView | null> {
  const { data, error } = await supabase.rpc("conversation_view", { p_conversation_id: conversationId });
  return error ? null : normalizeConversationView(data);
}

/** A page of messages, oldest first: before a sequence number, or everything after one. */
export async function listConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  { before = null, after = null, limit = MESSAGES_PAGE_SIZE }: { before?: number | null; after?: number | null; limit?: number } = {},
): Promise<ChatMessage[]> {
  const { data, error } = await supabase.rpc("conversation_messages_page", {
    p_conversation_id: conversationId,
    p_before_seq: before,
    p_after_seq: after,
    p_limit: limit,
  });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeMessageRow).filter((row): row is ChatMessage => Boolean(row));
}

/** One message for the live update, with its conversation; null when not the caller's to see. */
export async function getConversationMessage(
  supabase: SupabaseClient,
  messageId: string,
): Promise<(ChatMessage & { conversationId: string }) | null> {
  const { data, error } = await supabase.rpc("conversation_message", { p_message_id: messageId });
  const row = Array.isArray(data) ? data[0] : null;

  if (error || !row) {
    return null;
  }

  const message = normalizeMessageRow(row);
  const conversationId = (row as { conversation_id?: unknown }).conversation_id;

  return message && typeof conversationId === "string" ? { ...message, conversationId } : null;
}

/** The header badge. Empty on any error, e.g. before the migration. */
export async function getMessagingSummary(supabase: SupabaseClient): Promise<MessagingSummary> {
  const { data, error } = await supabase.rpc("my_messaging_summary");
  return error ? EMPTY_MESSAGING_SUMMARY : normalizeMessagingSummary(data);
}

export type MessagePermission = {
  status: "ok" | "exists" | MessageRefusalCode;
  conversationId: string | null;
};

/**
 * May the caller write to this person (as this company)? "exists" carries the
 * conversation to open instead. Null when the database is not there yet.
 */
export async function getMessagePermission(
  supabase: SupabaseClient,
  recipientUserId: string,
  companyId: string | null = null,
): Promise<MessagePermission | null> {
  const { data, error } = await supabase.rpc("message_permission", {
    p_recipient_user_id: recipientUserId,
    p_company_id: companyId,
  });

  if (error || !data) {
    return null;
  }

  const row = data as { status?: unknown; conversation_id?: unknown };
  const status = row.status === "ok" || row.status === "exists" ? row.status : toRefusalCode(row.status);

  return {
    status,
    conversationId: typeof row.conversation_id === "string" ? row.conversation_id : null,
  };
}

/** Which of these candidates the company already talks to: user id → conversation. */
export async function getTeamConversationIds(
  supabase: SupabaseClient,
  companyId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const { data, error } = await supabase.rpc("team_conversation_ids", {
    p_company_id: companyId,
    p_user_ids: Array.from(new Set(userIds)),
  });

  if (error || !Array.isArray(data)) return map;

  for (const row of data as Array<{ user_id: string; conversation_id: string }>) {
    map.set(row.user_id, row.conversation_id);
  }
  return map;
}

/** Which of these companies talk to the caller: company id → conversation. */
export async function getMyCompanyConversationIds(
  supabase: SupabaseClient,
  companyIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (companyIds.length === 0) return map;

  const { data, error } = await supabase.rpc("my_company_conversation_ids", {
    p_company_ids: Array.from(new Set(companyIds)),
  });

  if (error || !Array.isArray(data)) return map;

  for (const row of data as Array<{ company_id: string; conversation_id: string }>) {
    map.set(row.company_id, row.conversation_id);
  }
  return map;
}

export type MessagingScope = { id: string | null; name: string; unread: number };

/**
 * Whose messages the list can show: one's own, then each company the person
 * is in (accepted, page visible to the team), with what is new in each.
 */
export async function listMessagingScopes(
  supabase: SupabaseClient,
  userId: string,
  summary: MessagingSummary,
  personalLabel: string,
): Promise<MessagingScope[]> {
  const { data } = await supabase
    .from("company_members")
    .select("company:company_id ( id, name )")
    .eq("user_id", userId)
    .eq("status", "accepted");

  const unreadByCompany = new Map(summary.companies.map((item) => [item.companyId, item.unread]));
  const companies = ((data ?? []) as Array<{ company: { id: string; name: string } | Array<{ id: string; name: string }> | null }>)
    .map((row) => (Array.isArray(row.company) ? row.company[0] : row.company))
    .filter((company): company is { id: string; name: string } => Boolean(company?.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  return [
    { id: null, name: personalLabel, unread: summary.personalUnread + summary.requests },
    ...companies.map((company) => ({ id: company.id, name: company.name, unread: unreadByCompany.get(company.id) ?? 0 })),
  ];
}

// --- Writing -----------------------------------------------------------------------------

export type SendOutcome =
  | {
      ok: true;
      conversationId: string;
      messageId: string;
      seq: number;
      created: boolean;
      duplicate: boolean;
      scam: boolean;
    }
  | { ok: false; code: MessageRefusalCode; categories: string[] };

function toSendOutcome(data: unknown, error: { message?: string } | null): SendOutcome {
  if (error || !data || typeof data !== "object") {
    if (error) {
      console.error("[messages] send failed:", error.message);
    }
    return { ok: false, code: "failed", categories: [] };
  }

  const row = data as Record<string, unknown>;

  if (row.status !== "ok") {
    return {
      ok: false,
      code: toRefusalCode(row.status),
      categories: Array.isArray(row.categories) ? row.categories.filter((item): item is string => typeof item === "string") : [],
    };
  }

  if (typeof row.conversation_id !== "string" || typeof row.message_id !== "string") {
    return { ok: false, code: "failed", categories: [] };
  }

  return {
    ok: true,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    seq: Number(row.seq) || 0,
    created: row.created === true,
    duplicate: row.duplicate === true,
    scam: row.scam === true,
  };
}

/** Starts a conversation (or continues the existing one) with a message. */
export async function startConversation(
  supabase: SupabaseClient,
  input: {
    recipientUserId: string;
    body: string;
    clientId?: string | null;
    companyId?: string | null;
    applicationId?: string | null;
  },
): Promise<SendOutcome> {
  const { data, error } = await supabase.rpc("start_conversation", {
    p_recipient_user_id: input.recipientUserId,
    p_body: input.body,
    p_client_id: input.clientId ?? null,
    p_company_id: input.companyId ?? null,
    p_application_id: input.applicationId ?? null,
  });

  return toSendOutcome(data, error);
}

export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  body: string,
  clientId: string | null = null,
): Promise<SendOutcome> {
  const { data, error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_client_id: clientId,
  });

  return toSendOutcome(data, error);
}

/**
 * The caller read up to `seq` (everything when omitted). Returns the Resend
 * ids of the scheduled emails this made pointless, for cancelMessageEmails().
 */
export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  seq?: number,
): Promise<{ lastReadSeq: number; cancelEmailIds: string[] } | null> {
  const { data, error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_seq: seq ?? null,
  });

  const row = (data ?? null) as { status?: unknown; last_read_seq?: unknown; cancel_email_ids?: unknown } | null;

  if (error || !row || row.status !== "ok") {
    return null;
  }

  return {
    lastReadSeq: Number(row.last_read_seq) || 0,
    cancelEmailIds: Array.isArray(row.cancel_email_ids)
      ? row.cancel_email_ids.filter((id): id is string => typeof id === "string" && id !== "")
      : [],
  };
}

/** Accept, archive, mute, clear ("delete for me") or block, from the conversation menu. */
export async function applyConversationAction(
  supabase: SupabaseClient,
  conversationId: string,
  action: ConversationAction,
): Promise<{ ok: true; deleted: boolean } | { ok: false; code: "not_found" | "not_recipient" | "failed" }> {
  const call = (() => {
    switch (action.action) {
      case "accept":
        return supabase.rpc("accept_message_request", { p_conversation_id: conversationId });
      case "archive":
        return supabase.rpc("set_conversation_state", { p_conversation_id: conversationId, p_archived: action.value });
      case "mute":
        return supabase.rpc("set_conversation_state", { p_conversation_id: conversationId, p_muted: action.value });
      case "clear":
        return supabase.rpc("set_conversation_state", { p_conversation_id: conversationId, p_clear: true });
      case "block":
        return supabase.rpc("set_conversation_block", { p_conversation_id: conversationId, p_blocked: action.value });
    }
  })();

  const { data, error } = await call;

  if (error) {
    console.error("[messages] conversation action failed:", error.message);
    return { ok: false, code: "failed" };
  }

  const row = (data ?? {}) as { status?: unknown; deleted?: unknown };

  if (row.status === "ok") {
    return { ok: true, deleted: row.deleted === true };
  }

  return { ok: false, code: row.status === "not_recipient" ? "not_recipient" : "not_found" };
}

// --- Settings and blocks -------------------------------------------------------------------

export async function getMessagingSettings(supabase: SupabaseClient): Promise<MessagingSettings> {
  const { data, error } = await supabase.rpc("my_messaging_settings");
  return normalizeMessagingSettings(error ? null : data);
}

export async function saveMessagingSettings(
  supabase: SupabaseClient,
  input: { whoCanMessage?: WhoCanMessage; emailNotifications?: boolean; readReceipts?: boolean },
): Promise<MessagingSettings | null> {
  const { data, error } = await supabase.rpc("save_messaging_settings", {
    p_who_can_message: input.whoCanMessage ?? null,
    p_email_notifications: input.emailNotifications ?? null,
    p_read_receipts: input.readReceipts ?? null,
  });

  const row = (data ?? null) as { status?: unknown; settings?: unknown } | null;

  if (error || !row || row.status !== "ok") {
    return null;
  }

  return normalizeMessagingSettings(row.settings);
}

export async function listMessageBlocks(supabase: SupabaseClient): Promise<MessageBlock[]> {
  const { data, error } = await supabase.rpc("my_message_blocks");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeBlockRow).filter((row): row is MessageBlock => Boolean(row));
}

export async function removeMessageBlock(supabase: SupabaseClient, blockId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("remove_message_block", { p_block_id: blockId });
  return !error && (data as { status?: unknown } | null)?.status === "ok";
}

// --- Emails (service key) ------------------------------------------------------------------

function absoluteUrl(locale: Locale, path: string): string {
  return `${getSiteUrl().replace(/\/$/, "")}/${locale}${path}`;
}

type EmailJob = {
  job_id: number | string;
  recipient_user_id: string;
  conversation_id: string;
  sender_name: string | null;
  as_company: boolean;
  is_request: boolean;
};

/**
 * After a message went out: the database says whom to email (not someone who
 * read it, muted the conversation or turned the emails off; once per unread
 * stretch; at most 10 a day), and each email is scheduled 10 minutes ahead at
 * Resend. Reading the conversation before then cancels it. Never throws: a
 * lost email must not undo the message.
 */
export async function scheduleMessageEmails(messageId: string, now: number = Date.now()): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  try {
    const { data, error } = await admin.rpc("queue_message_emails", { p_message_id: messageId });

    if (error) {
      console.error("[messages] email queue failed:", error.message);
      return;
    }

    const scheduledAt = new Date(now + MESSAGE_EMAIL_DELAY_MS).toISOString();

    for (const job of (data ?? []) as EmailJob[]) {
      let resendId: string | null = null;

      try {
        const recipient = await loadEmailRecipient(admin, job.recipient_user_id);

        if (recipient?.emailConfirmed) {
          const message = buildNewMessageEmail({
            recipientName: recipient.name,
            senderName: job.sender_name ?? "",
            asCompany: job.as_company,
            isRequest: job.is_request,
            url: absoluteUrl(recipient.locale, buildConversationPath(job.conversation_id)),
            settingsUrl: absoluteUrl(recipient.locale, MESSAGES_SETTINGS_PATH),
            locale: recipient.locale,
          });
          const oneClick = buildMessageEmailOneClickUrl(job.recipient_user_id);
          const result = await sendEmail({
            to: recipient.email,
            ...message,
            scheduledAt,
            headers: oneClick
              ? { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
              : undefined,
          });
          resendId = result.sent && result.id ? result.id : null;
        }
      } catch (jobError) {
        console.error("[messages] email failed", { job: job.job_id, error: jobError });
      }

      // No id: the job goes, so the next message may try again.
      await admin.rpc("set_message_email_job", { p_job_id: Number(job.job_id), p_resend_id: resendId });
    }
  } catch (error) {
    console.error("[messages] scheduling emails failed", { messageId, error });
  }
}

/** The person read the conversation: stop the emails scheduled about it. */
export async function cancelMessageEmails(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => cancelScheduledEmail(id)));
}

/** The one-click "stop these emails" link. False without the service key or on an error. */
export async function turnOffMessageEmails(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin.rpc("turn_off_message_emails", { p_user_id: userId });
  if (error) {
    console.error("[messages] turning emails off failed:", error.message);
    return false;
  }
  return true;
}

/**
 * The daily cron: conversations 24 months quiet, old email jobs, ended
 * restrictions, report snapshots a year after the decision.
 */
export async function runMessagesHousekeeping(): Promise<Record<string, number>> {
  const admin = createAdminClient();

  if (!admin) {
    console.warn("[messages] SUPABASE_SERVICE_ROLE_KEY missing — nothing purged");
    return {};
  }

  const { data, error } = await admin.rpc("purge_inactive_conversations");

  if (error) {
    throw new Error(error.message);
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0]));
}

// --- Moderation ------------------------------------------------------------------------------

export type MessagingRestriction = {
  userId: string;
  person: MessagingPerson | null;
  scope: "new_conversations" | "all";
  until: string | null;
  reason: string | null;
  source: "admin" | "system";
  createdAt: string;
};

/** A moderator limits or frees someone's messaging (the admin's own session). */
export async function setMessagingRestriction(
  supabase: SupabaseClient,
  input: {
    userId: string;
    scope: "new_conversations" | "all" | null;
    days?: number | null;
    note?: string | null;
    reportId?: string | null;
  },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error } = await supabase.rpc("admin_set_messaging_restriction", {
    p_user_id: input.userId,
    p_scope: input.scope,
    p_days: input.days ?? null,
    p_note: input.note || null,
    p_report_id: input.reportId ?? null,
  });

  if (error) {
    return {
      ok: false,
      status: error.code === "42501" ? 403 : 400,
      error: error.message || "Could not change the restriction",
    };
  }

  return { ok: true };
}

export async function listMessagingRestrictions(supabase: SupabaseClient): Promise<MessagingRestriction[]> {
  const { data, error } = await supabase.rpc("admin_messaging_restrictions");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return (data as Array<Record<string, unknown>>).flatMap((row): MessagingRestriction[] => {
    if (typeof row.user_id !== "string") return [];
    return [
      {
        userId: row.user_id,
        person: normalizePerson(row.person),
        scope: row.scope === "all" ? "all" : "new_conversations",
        until: typeof row.until === "string" ? row.until : null,
        reason: typeof row.reason === "string" ? row.reason : null,
        source: row.source === "system" ? "system" : "admin",
        createdAt: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
      },
    ];
  });
}
