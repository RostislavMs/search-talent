/**
 * Messages (part 13, docs/messages.md): one-to-one conversations between two
 * people, or between a company page (its whole team) and a person. The
 * database decides everything — who may write, requests, limits, moderation,
 * who gets an email — through the functions in the messages migration. This
 * module only shapes what they return and words nothing itself: the texts are
 * in the dictionary (`messages`).
 */

import { parseLinkPreviewHref } from "@/lib/link-preview";

export const MESSAGES_PATH = "/messages";
export const MESSAGES_SETTINGS_PATH = "/messages/settings";
export const MESSAGE_MAX_LENGTH = 4000;
export const MESSAGES_PAGE_SIZE = 50;
export const CONVERSATIONS_PAGE_SIZE = 30;
/** The header badge polls like the notification bell, paused in hidden tabs. */
export const MESSAGES_POLL_INTERVAL_MS = 45_000;
/** Without a live connection the open conversation asks for new messages this often. */
export const MESSAGES_FALLBACK_POLL_MS = 10_000;

/** Hosts whose links count as "this site" (mirrors messaging_has_external_link()). */
export const SITE_HOST_PATTERN = /(^|\.)searchtalent\.(dev|com\.ua)$/i;

export function buildConversationPath(id: string): string {
  return `${MESSAGES_PATH}/${id}`;
}

/**
 * The full-height messages screens (the list and a conversation, not the
 * settings): the footer steps aside there. Takes a path with or without the
 * locale.
 */
export function isMessagesScreen(pathname: string | null): boolean {
  const route = (pathname || "/").replace(/^\/(uk|en)(?=\/|$)/, "").replace(/\/$/, "") || "/";
  return route === MESSAGES_PATH || /^\/messages\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(route);
}

export const conversationBoxes = ["inbox", "unread", "requests", "archived"] as const;
export type ConversationBox = (typeof conversationBoxes)[number];

/**
 * The query a list keeps in its links, so a conversation opens next to the
 * same list — and the same search, when it came from one.
 */
export function buildMessagesQuery(box: ConversationBox, companyId: string | null, search: string | null = null): string {
  const params = new URLSearchParams();
  if (box !== "inbox") params.set("box", box);
  if (companyId) params.set("company", companyId);
  if (search) params.set("q", search);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** ?q= on the messages pages: the search the list shows, when there is one. */
export function parseSearchParam(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const query = normalizeSearchQuery(raw);
  return query.length >= MESSAGE_SEARCH_MIN_LENGTH && query.length <= MESSAGE_SEARCH_MAX_LENGTH ? query : null;
}

export function parseConversationBox(value: unknown): ConversationBox {
  const raw = Array.isArray(value) ? value[0] : value;
  return conversationBoxes.includes(raw as ConversationBox) ? (raw as ConversationBox) : "inbox";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** ?company= on the messages pages: a company's team inbox. */
export function parseCompanyParam(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return isUuid(raw) ? raw : null;
}

export const whoCanMessageOptions = ["everyone", "verified_companies", "nobody"] as const;
export type WhoCanMessage = (typeof whoCanMessageOptions)[number];

export type ConversationSide = "self" | "person" | "company";
export type ConversationKind = "direct" | "company";
export type BlockState = "by_me" | "by_them" | null;

export type MessagingPerson = {
  userId: string | null;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  headline: string | null;
  /** False for a deleted account or a profile hidden by moderation. */
  available: boolean;
};

export type MessagingCompany = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  verified: boolean;
  visible: boolean;
};

export type MessageEventKind = "application" | "application_status";

export type MessageEventData = {
  applicationId: string | null;
  vacancyId: string | null;
  vacancySlug: string | null;
  vacancyTitle: string | null;
  status: string | null;
};

export type ChatMessage = {
  id: string;
  seq: number;
  kind: "text" | "event";
  event: MessageEventKind | null;
  eventData: MessageEventData | null;
  /** Null while a moderator looks at it (only its author still sees the text); "" when removed. */
  body: string | null;
  asCompany: boolean;
  /** On the caller's side: theirs, or a colleague's on a company's side. */
  fromMySide: boolean;
  mine: boolean;
  author: MessagingPerson | null;
  /** "Pay first" / "move to a messenger": the recipient sees a warning. */
  scamFlag: boolean;
  held: boolean;
  removed: boolean;
  /** Who removed it: whoever wrote it, or a moderator. Null while it is there. */
  removedBy: MessageRemovedBy | null;
  editedAt: string | null;
  /** Until when the caller may still edit their own message; null when they cannot. */
  editableUntil: string | null;
  createdAt: string;
};

export type MessageRemovedBy = "author" | "moderator";

export type LastMessagePreview = {
  id: string;
  seq: number;
  kind: "text" | "event";
  event: MessageEventKind | null;
  eventData: MessageEventData | null;
  body: string | null;
  held: boolean;
  removed: boolean;
  removedBy: MessageRemovedBy | null;
  fromMySide: boolean;
  mine: boolean;
  createdAt: string;
};

export type ConversationPreview = {
  id: string;
  kind: ConversationKind;
  side: ConversationSide;
  state: "request" | "open";
  requestToMe: boolean;
  awaitingReply: boolean;
  blocked: BlockState;
  /** The other person: in a direct conversation, or the candidate on a company's side. */
  counterpart: MessagingPerson | null;
  company: MessagingCompany | null;
  lastMessage: LastMessagePreview | null;
  lastMessageAt: string;
  unreadCount: number;
  archived: boolean;
  muted: boolean;
};

export type ConversationApplication = {
  applicationId: string;
  vacancyId: string;
  vacancySlug: string;
  vacancyTitle: string;
  status: string;
};

export type ConversationView = {
  id: string;
  kind: ConversationKind;
  side: ConversationSide;
  state: "request" | "open";
  origin: "direct" | "application";
  requestToMe: boolean;
  awaitingReply: boolean;
  canSend: boolean;
  cannotSendReason: string | null;
  /** The next message is still part of a request: one message, no outside links. */
  requestRules: boolean;
  blocked: BlockState;
  counterpart: MessagingPerson | null;
  company: MessagingCompany | null;
  myLastReadSeq: number;
  /** Null unless both sides show read receipts. */
  theirLastReadSeq: number | null;
  archived: boolean;
  muted: boolean;
  createdAt: string;
  applications: ConversationApplication[];
};

/**
 * Message emails: 10 minutes after a message stays unread ("instant"), one
 * morning email about what came in ("daily"), or none.
 */
export const messageEmailModes = ["instant", "daily", "off"] as const;
export type MessageEmailMode = (typeof messageEmailModes)[number];

export type MessagingSettings = {
  whoCanMessage: WhoCanMessage;
  /** Any message emails at all; the choice itself is `messageEmails`. */
  emailNotifications: boolean;
  messageEmails: MessageEmailMode;
  readReceipts: boolean;
};

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  whoCanMessage: "everyone",
  emailNotifications: true,
  messageEmails: "instant",
  readReceipts: true,
};

/** The email choices, kept in one place for every kind of email that has one. */
export type NotificationPreferences = {
  messageEmails: MessageEmailMode;
  followerEmails: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messageEmails: "instant",
  followerEmails: true,
};

export const NOTIFICATION_SETTINGS_PATH = "/notifications/settings";

export type MessagingSummary = {
  hasConversations: boolean;
  /** Conversations with something new: one's own and every company inbox. */
  unread: number;
  personalUnread: number;
  /** Requests waiting for the person's answer. */
  requests: number;
  companies: Array<{ companyId: string; unread: number }>;
};

export const EMPTY_MESSAGING_SUMMARY: MessagingSummary = {
  hasConversations: false,
  unread: 0,
  personalUnread: 0,
  requests: 0,
  companies: [],
};

export type MessageBlock = {
  id: string;
  /** The company that blocked, when a team did. */
  byCompany: MessagingCompany | null;
  person: MessagingPerson | null;
  company: MessagingCompany | null;
  createdAt: string;
};

/**
 * Writing to someone from their profile: "ok" (may write), "exists" (already
 * talking: open it), "signin" (a guest), or why not (message_permission()'s
 * refusal).
 */
export type ProfileMessaging = {
  recipientUserId: string;
  status: string;
  conversationId: string | null;
};

/** Whether the contact dialog has a way to write worth opening it for. */
export function messagingIsOffered(messaging: ProfileMessaging | null | undefined): boolean {
  return messaging?.status === "ok" || messaging?.status === "exists";
}

/**
 * Why a message could not go out, as the database says it. The dictionary
 * words each one (`messages.errors`); anything else is "failed".
 */
export const messageRefusalCodes = [
  "unauthorized",
  "email_unconfirmed",
  "restricted",
  "self",
  "not_found",
  "no_profile",
  "blocked",
  "blocked_by_me",
  "not_accepting",
  "company_not_allowed",
  "company_not_verified",
  "company_hidden",
  "own_company",
  "invalid_application",
  "closed",
  "awaiting_reply",
  "rate_limited",
  "company_rate_limited",
  "empty",
  "too_long",
  "links_in_request",
  "moderation_blocked",
  // Editing one's own message.
  "not_editable",
  "edit_window_passed",
  "too_many_edits",
  "failed",
] as const;

export type MessageRefusalCode = (typeof messageRefusalCodes)[number];

export function toRefusalCode(value: unknown): MessageRefusalCode {
  return messageRefusalCodes.includes(value as MessageRefusalCode) ? (value as MessageRefusalCode) : "failed";
}

/** The HTTP status a refusal maps to (routes answer with {code}). */
export function refusalHttpStatus(code: MessageRefusalCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "not_found":
      return 404;
    case "rate_limited":
    case "company_rate_limited":
      return 429;
    case "not_editable":
      return 409;
    case "failed":
      return 500;
    case "empty":
    case "too_long":
    case "links_in_request":
    case "moderation_blocked":
    case "invalid_application":
    case "self":
      return 400;
    default:
      return 403;
  }
}

// --- Normalizing what the database returns ---------------------------------------------

type Raw = Record<string, unknown>;

function asRecord(value: unknown): Raw | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

export function normalizePerson(value: unknown): MessagingPerson | null {
  const row = asRecord(value);
  if (!row) return null;

  return {
    userId: str(row.userId),
    username: str(row.username),
    name: str(row.name),
    avatarUrl: str(row.avatarUrl),
    headline: str(row.headline),
    available: bool(row.available),
  };
}

export function normalizeCompany(value: unknown): MessagingCompany | null {
  const row = asRecord(value);
  const id = str(row?.id);
  if (!row || !id) return null;

  return {
    id,
    slug: str(row.slug) ?? "",
    name: str(row.name) ?? "",
    logoUrl: str(row.logoUrl),
    verified: bool(row.verified),
    visible: row.visible !== false,
  };
}

function normalizeEventKind(value: unknown): MessageEventKind | null {
  return value === "application" || value === "application_status" ? value : null;
}

export function normalizeEventData(value: unknown): MessageEventData | null {
  const row = asRecord(value);
  if (!row) return null;

  return {
    applicationId: str(row.applicationId),
    vacancyId: str(row.vacancyId),
    vacancySlug: str(row.vacancySlug),
    vacancyTitle: str(row.vacancyTitle),
    status: str(row.status),
  };
}

function normalizeBlock(value: unknown): BlockState {
  return value === "by_me" || value === "by_them" ? value : null;
}

function normalizeSide(value: unknown): ConversationSide {
  return value === "person" || value === "company" ? value : "self";
}

/** A body: text, null while held, "" when removed. */
function normalizeBody(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeRemovedBy(value: unknown): MessageRemovedBy | null {
  return value === "author" || value === "moderator" ? value : null;
}

export function normalizeMessageRow(value: unknown): ChatMessage | null {
  const row = asRecord(value);
  const id = str(row?.id);
  if (!row || !id) return null;

  const kind = row.kind === "event" ? "event" : "text";

  return {
    id,
    seq: num(row.seq),
    kind,
    event: kind === "event" ? normalizeEventKind(row.event) : null,
    eventData: kind === "event" ? normalizeEventData(row.event_data) : null,
    body: normalizeBody(row.body),
    asCompany: bool(row.as_company),
    fromMySide: bool(row.from_my_side),
    mine: bool(row.mine),
    author: normalizePerson(row.author),
    scamFlag: bool(row.scam_flag),
    held: bool(row.held),
    removed: bool(row.removed),
    removedBy: bool(row.removed) ? (normalizeRemovedBy(row.removed_by) ?? "moderator") : null,
    editedAt: str(row.edited_at),
    editableUntil: str(row.editable_until),
    createdAt: str(row.created_at) ?? new Date(0).toISOString(),
  };
}

function normalizeLastMessage(value: unknown): LastMessagePreview | null {
  const row = asRecord(value);
  const id = str(row?.id);
  if (!row || !id) return null;

  const kind = row.kind === "event" ? "event" : "text";

  return {
    id,
    seq: num(row.seq),
    kind,
    event: kind === "event" ? normalizeEventKind(row.event) : null,
    eventData: kind === "event" ? normalizeEventData(row.eventData) : null,
    body: normalizeBody(row.body),
    held: bool(row.held),
    removed: bool(row.removed),
    removedBy: bool(row.removed) ? (normalizeRemovedBy(row.removedBy) ?? "moderator") : null,
    fromMySide: bool(row.fromMySide),
    mine: bool(row.mine),
    createdAt: str(row.createdAt) ?? new Date(0).toISOString(),
  };
}

export function normalizeConversationRow(value: unknown): ConversationPreview | null {
  const row = asRecord(value);
  const id = str(row?.id);
  if (!row || !id) return null;

  return {
    id,
    kind: row.kind === "company" ? "company" : "direct",
    side: normalizeSide(row.side),
    state: row.state === "open" ? "open" : "request",
    requestToMe: bool(row.request_to_me),
    awaitingReply: bool(row.awaiting_reply),
    blocked: normalizeBlock(row.blocked),
    counterpart: normalizePerson(row.counterpart),
    company: normalizeCompany(row.company),
    lastMessage: normalizeLastMessage(row.last_message),
    lastMessageAt: str(row.last_message_at) ?? new Date(0).toISOString(),
    unreadCount: num(row.unread_count),
    archived: bool(row.archived),
    muted: bool(row.muted),
  };
}

export function normalizeConversationView(value: unknown): ConversationView | null {
  const outer = asRecord(value);
  const row = asRecord(outer?.conversation);
  const id = str(row?.id);
  if (!outer || outer.status !== "ok" || !row || !id) return null;

  const applications = Array.isArray(row.applications) ? row.applications : [];

  return {
    id,
    kind: row.kind === "company" ? "company" : "direct",
    side: normalizeSide(row.side),
    state: row.state === "open" ? "open" : "request",
    origin: row.origin === "application" ? "application" : "direct",
    requestToMe: bool(row.requestToMe),
    awaitingReply: bool(row.awaitingReply),
    canSend: bool(row.canSend),
    cannotSendReason: str(row.cannotSendReason),
    requestRules: bool(row.requestRules),
    blocked: normalizeBlock(row.blocked),
    counterpart: normalizePerson(row.counterpart),
    company: normalizeCompany(row.company),
    myLastReadSeq: num(row.myLastReadSeq),
    theirLastReadSeq: row.theirLastReadSeq === null || row.theirLastReadSeq === undefined ? null : num(row.theirLastReadSeq),
    archived: bool(row.archived),
    muted: bool(row.muted),
    createdAt: str(row.createdAt) ?? new Date(0).toISOString(),
    applications: applications.flatMap((item): ConversationApplication[] => {
      const application = asRecord(item);
      const applicationId = str(application?.applicationId);
      if (!application || !applicationId) return [];
      return [
        {
          applicationId,
          vacancyId: str(application.vacancyId) ?? "",
          vacancySlug: str(application.vacancySlug) ?? "",
          vacancyTitle: str(application.vacancyTitle) ?? "",
          status: str(application.status) ?? "new",
        },
      ];
    }),
  };
}

function normalizeMessageEmailMode(value: unknown, fallback: MessageEmailMode): MessageEmailMode {
  return messageEmailModes.includes(value as MessageEmailMode) ? (value as MessageEmailMode) : fallback;
}

export function normalizeMessagingSettings(value: unknown): MessagingSettings {
  const row = asRecord(value);
  if (!row) return DEFAULT_MESSAGING_SETTINGS;

  const emailNotifications = row.emailNotifications !== false;

  return {
    whoCanMessage: whoCanMessageOptions.includes(row.whoCanMessage as WhoCanMessage)
      ? (row.whoCanMessage as WhoCanMessage)
      : "everyone",
    emailNotifications,
    messageEmails: normalizeMessageEmailMode(row.messageEmails, emailNotifications ? "instant" : "off"),
    readReceipts: row.readReceipts !== false,
  };
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const row = asRecord(value);
  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    messageEmails: normalizeMessageEmailMode(row.messageEmails, "instant"),
    followerEmails: row.followerEmails !== false,
  };
}

export function normalizeMessagingSummary(value: unknown): MessagingSummary {
  const row = asRecord(value);
  if (!row) return EMPTY_MESSAGING_SUMMARY;

  const companies = Array.isArray(row.companies) ? row.companies : [];

  return {
    hasConversations: bool(row.hasConversations),
    unread: num(row.unread),
    personalUnread: num(row.personalUnread),
    requests: num(row.requests),
    companies: companies.flatMap((item) => {
      const company = asRecord(item);
      const companyId = str(company?.companyId);
      return company && companyId ? [{ companyId, unread: num(company.unread) }] : [];
    }),
  };
}

export function normalizeBlockRow(value: unknown): MessageBlock | null {
  const row = asRecord(value);
  const id = str(row?.id);
  if (!row || !id) return null;

  return {
    id,
    byCompany: normalizeCompany(row.by_company),
    person: normalizePerson(row.person),
    company: normalizeCompany(row.company),
    createdAt: str(row.created_at) ?? new Date(0).toISOString(),
  };
}

/** The badge in the header: what is new, requests included. */
export function summaryBadgeCount(summary: MessagingSummary): number {
  return summary.unread + summary.requests;
}

// --- Display -------------------------------------------------------------------------------

/** A person's name as the messages show it: the name, else @nick, else the fallback. */
export function personLabel(person: MessagingPerson | null | undefined, fallback: string): string {
  if (!person) return fallback;
  return person.name || (person.username ? `@${person.username}` : fallback);
}

/**
 * Who a conversation is with, from the caller's side: the other person, the
 * company (for the person), or the candidate (for the company's team).
 */
export function conversationPartner(
  conversation: Pick<ConversationPreview, "kind" | "side" | "counterpart" | "company">,
  deletedLabel: string,
): { title: string; imageUrl: string | null; href: string | null; isCompany: boolean; available: boolean } {
  if (conversation.kind === "company" && conversation.side === "person") {
    const company = conversation.company;
    return {
      title: company?.name || deletedLabel,
      imageUrl: company?.logoUrl ?? null,
      href: company?.slug ? `/companies/${company.slug}` : null,
      isCompany: true,
      available: Boolean(company?.visible),
    };
  }

  const person = conversation.counterpart;
  const available = Boolean(person?.available);

  return {
    title: available ? personLabel(person, deletedLabel) : deletedLabel,
    imageUrl: available ? (person?.avatarUrl ?? null) : null,
    href: available && person?.username ? `/u/${person.username}` : null,
    isCompany: false,
    available,
  };
}

export function initialOf(label: string): string {
  return label.replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "?";
}

// --- Text ----------------------------------------------------------------------------------

export type MessageTextPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string; host: string; external: boolean };

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/**
 * Parses a link found in a message and keeps it only when it is http(s).
 * The href a message renders is always the parser's own `url.href`, never
 * the text the user typed, so no `javascript:` or other scheme gets through.
 */
export function safeMessageUrl(candidate: string): URL | null {
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isSiteHost(host: string, extraHosts: string[] = []): boolean {
  const normalized = host.toLowerCase().replace(/^www\./, "");
  return SITE_HOST_PATTERN.test(normalized) || extraHosts.some((extra) => extra.toLowerCase() === normalized);
}

/**
 * Splits plain text into text and link parts. Only http(s) links (and www.)
 * become links; nothing else in a message is markup. `siteHosts` adds hosts
 * that count as this site (e.g. the deployment's own host).
 */
export function splitMessageText(text: string, siteHosts: string[] = []): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let last = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    const url = safeMessageUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url?.hostname.toLowerCase();

    if (!url || !host || trimmed.length === 0) {
      continue;
    }

    if (start > last) {
      parts.push({ type: "text", value: text.slice(last, start) });
    }

    parts.push({
      type: "link",
      href: url.href,
      label: trimmed,
      host: host.replace(/^www\./, ""),
      external: !isSiteHost(host, siteHosts),
    });
    last = start + trimmed.length;
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }

  return parts;
}

/**
 * Whether a request message would be refused for an outside link — the same
 * rule as messaging_has_external_link(): any http(s)/www link off this site,
 * and t.me / wa.me links even without a scheme.
 */
export function hasExternalLink(text: string, siteHosts: string[] = []): boolean {
  if (/(^|[^a-z0-9.])(t\.me|telegram\.me|wa\.me)\//i.test(text)) {
    return true;
  }

  return splitMessageText(text, siteHosts).some((part) => part.type === "link" && part.external);
}

/** "2026-10-10" in the given time zone: messages are grouped by day. */
export function messageDayKey(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Messages in seq order without duplicates (a live update can repeat one already loaded). */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort((left, right) => left.seq - right.seq);
}

/** The last message from the caller's side that the other side has read, for "Read". */
export function lastReadOwnMessageId(messages: ChatMessage[], theirLastReadSeq: number | null): string | null {
  if (theirLastReadSeq === null) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === "text" && message.fromMySide && message.seq <= theirLastReadSeq) {
      return message.id;
    }
  }

  return null;
}

// --- Editing ---------------------------------------------------------------------------------

/**
 * Whether the caller may still edit this message of theirs. The database sets
 * the window (15 minutes, at most 10 edits) and says until when; this only
 * hides the action once that moment has passed on the open page.
 */
export function canEditMessage(message: Pick<ChatMessage, "editableUntil">, now: number = Date.now()): boolean {
  if (!message.editableUntil) return false;
  const until = Date.parse(message.editableUntil);
  return Number.isFinite(until) && until > now;
}

// --- Search ----------------------------------------------------------------------------------

export const MESSAGE_SEARCH_MIN_LENGTH = 2;
export const MESSAGE_SEARCH_MAX_LENGTH = 100;

/**
 * One search hit: a message (with a snippet around the match), or a
 * conversation whose name matched (messageId null). search_messages() puts
 * the name matches first.
 */
export type MessageSearchResult = {
  conversationId: string;
  kind: ConversationKind;
  side: ConversationSide;
  counterpart: MessagingPerson | null;
  company: MessagingCompany | null;
  messageId: string | null;
  seq: number | null;
  snippet: string | null;
  fromMySide: boolean;
  createdAt: string;
};

export function normalizeSearchResult(value: unknown): MessageSearchResult | null {
  const row = asRecord(value);
  const conversationId = str(row?.conversation_id);
  if (!row || !conversationId) return null;

  const messageId = str(row.message_id);

  return {
    conversationId,
    kind: row.kind === "company" ? "company" : "direct",
    side: normalizeSide(row.side),
    counterpart: normalizePerson(row.counterpart),
    company: normalizeCompany(row.company),
    messageId,
    seq: messageId && row.seq !== null && row.seq !== undefined ? num(row.seq) : null,
    snippet: messageId ? (typeof row.snippet === "string" ? row.snippet : "") : null,
    fromMySide: bool(row.from_my_side),
    createdAt: str(row.created_at) ?? new Date(0).toISOString(),
  };
}

/** The query as the search uses it: spaces squeezed, trimmed. */
export function normalizeSearchQuery(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Splits text around every case-insensitive occurrence of the query, for
 * <mark>: plain parts and matched parts, never markup.
 */
export function splitHighlight(text: string, query: string): Array<{ text: string; match: boolean }> {
  const needle = normalizeSearchQuery(query).toLowerCase();
  if (!needle) return text ? [{ text, match: false }] : [];

  const haystack = text.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let last = 0;
  let at = haystack.indexOf(needle);

  while (at >= 0) {
    if (at > last) parts.push({ text: text.slice(last, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    last = at + needle.length;
    at = haystack.indexOf(needle, last);
  }

  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

/** ?m= on a conversation: the message a search result opens at. */
export function parseFocusSeq(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !/^\d{1,15}$/.test(raw)) return null;
  const seq = Number(raw);
  return seq > 0 ? seq : null;
}

/** A conversation's address next to its list, opened at a message when `seq` is given. */
export function buildConversationHref(id: string, listQuery: string, seq: number | null = null): string {
  const params = new URLSearchParams(listQuery.replace(/^\?/, ""));
  if (seq !== null) params.set("m", String(seq));
  const query = params.toString();
  return `${buildConversationPath(id)}${query ? `?${query}` : ""}`;
}

// --- Link cards --------------------------------------------------------------------------------

/** At most this many cards under one message: a list of links stays a list. */
export const MESSAGE_LINK_CARDS_LIMIT = 2;

/**
 * The links in a message to this site's pages that have a card (a profile, a
 * project, an article, a poll, a vacancy, a company), as site paths, each
 * once, at most `limit`.
 */
export function messageLinkTargets(text: string, siteHosts: string[] = [], limit: number = MESSAGE_LINK_CARDS_LIMIT): string[] {
  const paths: string[] = [];

  for (const part of splitMessageText(text, siteHosts)) {
    if (paths.length >= limit) break;
    if (part.type !== "link" || part.external) continue;

    const url = safeMessageUrl(part.href);
    const path = url ? url.pathname.replace(/\/+$/, "") || "/" : null;

    if (path && !paths.includes(path) && parseLinkPreviewHref(path)) {
      paths.push(path);
    }
  }

  return paths;
}

/** A random id for one send attempt: a retry with the same id is not a second message. */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Older browsers: RFC 4122 v4 from Math.random — only an idempotency key.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
