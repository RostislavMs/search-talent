import { describe, expect, it } from "vitest";
import {
  buildConversationHref,
  buildConversationPath,
  buildMessagesQuery,
  canEditMessage,
  conversationPartner,
  DEFAULT_NOTIFICATION_PREFERENCES,
  messageLinkTargets,
  normalizeNotificationPreferences,
  normalizeSearchQuery,
  normalizeSearchResult,
  parseFocusSeq,
  parseSearchParam,
  splitHighlight,
  EMPTY_MESSAGING_SUMMARY,
  hasExternalLink,
  initialOf,
  isMessagesScreen,
  isSiteHost,
  isUuid,
  lastReadOwnMessageId,
  mergeMessages,
  messageDayKey,
  messageRefusalCodes,
  messagingIsOffered,
  newClientId,
  normalizeBlockRow,
  normalizeCompany,
  normalizeConversationRow,
  normalizeConversationView,
  normalizeMessageRow,
  normalizeMessagingSettings,
  normalizeMessagingSummary,
  normalizePerson,
  parseCompanyParam,
  parseConversationBox,
  personLabel,
  refusalHttpStatus,
  safeMessageUrl,
  splitMessageText,
  summaryBadgeCount,
  toRefusalCode,
  type ChatMessage,
} from "@/lib/messages";

const ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function message(seq: number, patch: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${seq}`,
    seq,
    kind: "text",
    event: null,
    eventData: null,
    body: `text ${seq}`,
    asCompany: false,
    fromMySide: false,
    mine: false,
    author: null,
    scamFlag: false,
    held: false,
    removed: false,
    removedBy: null,
    editedAt: null,
    editableUntil: null,
    createdAt: "2026-10-10T10:00:00Z",
    ...patch,
  };
}

describe("paths and params", () => {
  it("builds the conversation path", () => {
    expect(buildConversationPath(ID)).toBe(`/messages/${ID}`);
  });

  it("keeps only the non-default box and the company in the query", () => {
    expect(buildMessagesQuery("inbox", null)).toBe("");
    expect(buildMessagesQuery("requests", null)).toBe("?box=requests");
    expect(buildMessagesQuery("inbox", ID)).toBe(`?company=${ID}`);
    expect(buildMessagesQuery("archived", ID)).toBe(`?box=archived&company=${ID}`);
  });

  it("reads the box, falling back to the inbox", () => {
    expect(parseConversationBox("requests")).toBe("requests");
    expect(parseConversationBox(["unread", "archived"])).toBe("unread");
    expect(parseConversationBox("spam")).toBe("inbox");
    expect(parseConversationBox(undefined)).toBe("inbox");
  });

  it("knows the full-height messages screens", () => {
    expect(isMessagesScreen("/uk/messages")).toBe(true);
    expect(isMessagesScreen("/en/messages/")).toBe(true);
    expect(isMessagesScreen(`/uk/messages/${ID}`)).toBe(true);
    expect(isMessagesScreen("/messages")).toBe(true);
    expect(isMessagesScreen("/uk/messages/settings")).toBe(false);
    expect(isMessagesScreen("/uk/messages-archive")).toBe(false);
    expect(isMessagesScreen("/uk/jobs")).toBe(false);
    expect(isMessagesScreen(null)).toBe(false);
  });

  it("reads a company id only when it is a uuid", () => {
    expect(parseCompanyParam(ID)).toBe(ID);
    expect(parseCompanyParam([ID])).toBe(ID);
    expect(parseCompanyParam("acme")).toBeNull();
    expect(parseCompanyParam(undefined)).toBeNull();
    expect(isUuid(ID)).toBe(true);
    expect(isUuid(42)).toBe(false);
  });
});

describe("refusals", () => {
  it("keeps known codes and turns anything else into 'failed'", () => {
    expect(toRefusalCode("awaiting_reply")).toBe("awaiting_reply");
    expect(toRefusalCode("whatever")).toBe("failed");
    expect(toRefusalCode(undefined)).toBe("failed");
  });

  it("maps every code to an HTTP status", () => {
    expect(refusalHttpStatus("unauthorized")).toBe(401);
    expect(refusalHttpStatus("not_found")).toBe(404);
    expect(refusalHttpStatus("rate_limited")).toBe(429);
    expect(refusalHttpStatus("company_rate_limited")).toBe(429);
    expect(refusalHttpStatus("failed")).toBe(500);
    expect(refusalHttpStatus("too_long")).toBe(400);
    expect(refusalHttpStatus("links_in_request")).toBe(400);
    expect(refusalHttpStatus("blocked")).toBe(403);
    expect(refusalHttpStatus("not_editable")).toBe(409);
    expect(refusalHttpStatus("edit_window_passed")).toBe(403);
    expect(refusalHttpStatus("too_many_edits")).toBe(403);
    for (const code of messageRefusalCodes) {
      expect([400, 401, 403, 404, 409, 429, 500]).toContain(refusalHttpStatus(code));
    }
  });
});

describe("normalizing", () => {
  it("normalizes a person and a company", () => {
    expect(
      normalizePerson({ userId: ID, username: "olena", name: "", avatarUrl: null, headline: "Designer", available: true }),
    ).toEqual({ userId: ID, username: "olena", name: null, avatarUrl: null, headline: "Designer", available: true });
    expect(normalizePerson(null)).toBeNull();
    expect(normalizeCompany({ id: ID, slug: "acme", name: "Acme", logoUrl: null, verified: true })).toEqual({
      id: ID,
      slug: "acme",
      name: "Acme",
      logoUrl: null,
      verified: true,
      visible: true,
    });
    expect(normalizeCompany({ slug: "x" })).toBeNull();
  });

  it("normalizes a message row, events included", () => {
    const text = normalizeMessageRow({
      id: "m1",
      seq: "7",
      kind: "text",
      body: "Hi",
      as_company: true,
      from_my_side: true,
      mine: false,
      author: { userId: OTHER, username: "olena", available: true },
      scam_flag: false,
      held: false,
      removed: false,
      edited_at: null,
      created_at: "2026-10-10T10:00:00Z",
      event: "application",
    });
    expect(text).toMatchObject({ id: "m1", seq: 7, kind: "text", event: null, body: "Hi", asCompany: true, fromMySide: true });
    expect(text?.author?.username).toBe("olena");

    const event = normalizeMessageRow({
      id: "m2",
      seq: 8,
      kind: "event",
      event: "application_status",
      event_data: { vacancyTitle: "Designer", status: "shortlisted" },
      body: "",
      created_at: "2026-10-10T10:00:00Z",
    });
    expect(event).toMatchObject({ kind: "event", event: "application_status" });
    expect(event?.eventData).toMatchObject({ vacancyTitle: "Designer", status: "shortlisted", applicationId: null });

    expect(normalizeMessageRow({ seq: 1 })).toBeNull();
    expect(normalizeMessageRow({ id: "m3", body: null })?.body).toBeNull();
  });

  it("normalizes a conversation row", () => {
    const row = normalizeConversationRow({
      id: ID,
      kind: "company",
      side: "person",
      state: "request",
      request_to_me: true,
      awaiting_reply: false,
      blocked: "nope",
      counterpart: null,
      company: { id: OTHER, slug: "acme", name: "Acme" },
      last_message: { id: "m1", seq: 3, kind: "text", body: "Hello", fromMySide: false, mine: false, createdAt: "2026-10-10T10:00:00Z" },
      last_message_at: "2026-10-10T10:00:00Z",
      unread_count: "2",
      archived: false,
      muted: true,
    });
    expect(row).toMatchObject({
      kind: "company",
      side: "person",
      state: "request",
      requestToMe: true,
      blocked: null,
      unreadCount: 2,
      muted: true,
    });
    expect(row?.lastMessage).toMatchObject({ body: "Hello", seq: 3 });
    expect(normalizeConversationRow({})).toBeNull();
  });

  it("normalizes a view only when the status is ok", () => {
    expect(normalizeConversationView({ status: "not_found" })).toBeNull();
    const view = normalizeConversationView({
      status: "ok",
      conversation: {
        id: ID,
        kind: "direct",
        side: "self",
        state: "open",
        origin: "direct",
        canSend: false,
        cannotSendReason: "awaiting_reply",
        requestRules: true,
        blocked: "by_them",
        myLastReadSeq: 4,
        theirLastReadSeq: null,
        applications: [{ applicationId: OTHER, vacancyTitle: "Designer", status: "viewed" }, { nope: true }],
      },
    });
    expect(view).toMatchObject({
      id: ID,
      canSend: false,
      cannotSendReason: "awaiting_reply",
      requestRules: true,
      blocked: "by_them",
      myLastReadSeq: 4,
      theirLastReadSeq: null,
    });
    expect(view?.applications).toHaveLength(1);
    expect(normalizeConversationView({ status: "ok", conversation: { id: ID, theirLastReadSeq: 0 } })?.theirLastReadSeq).toBe(0);
  });

  it("normalizes settings with the defaults", () => {
    expect(normalizeMessagingSettings(null)).toEqual({
      whoCanMessage: "everyone",
      emailNotifications: true,
      messageEmails: "instant",
      readReceipts: true,
    });
    expect(
      normalizeMessagingSettings({ whoCanMessage: "nobody", emailNotifications: false, readReceipts: false }),
    ).toEqual({ whoCanMessage: "nobody", emailNotifications: false, messageEmails: "off", readReceipts: false });
    expect(normalizeMessagingSettings({ messageEmails: "daily", emailNotifications: true }).messageEmails).toBe("daily");
    expect(normalizeMessagingSettings({ messageEmails: "weekly" }).messageEmails).toBe("instant");
    expect(normalizeMessagingSettings({ whoCanMessage: "friends" }).whoCanMessage).toBe("everyone");
  });

  it("normalizes the summary and counts the badge", () => {
    expect(normalizeMessagingSummary(null)).toEqual(EMPTY_MESSAGING_SUMMARY);
    const summary = normalizeMessagingSummary({
      hasConversations: true,
      unread: 3,
      personalUnread: 1,
      requests: 2,
      companies: [{ companyId: ID, unread: 2 }, { unread: 1 }],
    });
    expect(summary.companies).toEqual([{ companyId: ID, unread: 2 }]);
    expect(summaryBadgeCount(summary)).toBe(5);
  });

  it("normalizes a block", () => {
    expect(
      normalizeBlockRow({ id: ID, by_company: null, person: { userId: OTHER, username: "bob", available: true }, company: null, created_at: "x" }),
    ).toMatchObject({ id: ID, byCompany: null, company: null, person: { username: "bob" } });
    expect(normalizeBlockRow({})).toBeNull();
  });
});

describe("display", () => {
  it("labels a person", () => {
    expect(personLabel({ userId: ID, username: "olena", name: "Olena", avatarUrl: null, headline: null, available: true }, "?")).toBe("Olena");
    expect(personLabel({ userId: ID, username: "olena", name: null, avatarUrl: null, headline: null, available: true }, "?")).toBe("@olena");
    expect(personLabel(null, "Deleted")).toBe("Deleted");
  });

  it("names the other side from the caller's side", () => {
    const company = { id: ID, slug: "acme", name: "Acme", logoUrl: "https://x/logo.png", verified: true, visible: true };
    const person = { userId: OTHER, username: "bob", name: "Bob", avatarUrl: null, headline: null, available: true };

    expect(conversationPartner({ kind: "company", side: "person", company, counterpart: null }, "gone")).toEqual({
      title: "Acme",
      imageUrl: "https://x/logo.png",
      href: "/companies/acme",
      isCompany: true,
      available: true,
    });
    expect(conversationPartner({ kind: "company", side: "company", company, counterpart: person }, "gone")).toMatchObject({
      title: "Bob",
      href: "/u/bob",
      isCompany: false,
    });
    expect(
      conversationPartner({ kind: "direct", side: "self", company: null, counterpart: { ...person, available: false } }, "Deleted"),
    ).toMatchObject({ title: "Deleted", href: null, imageUrl: null, available: false });
  });

  it("takes the first letter", () => {
    expect(initialOf("@olena")).toBe("O");
    expect(initialOf("")).toBe("?");
  });

  it("offers messaging only when one may write or already talks", () => {
    expect(messagingIsOffered({ recipientUserId: ID, status: "ok", conversationId: null })).toBe(true);
    expect(messagingIsOffered({ recipientUserId: ID, status: "exists", conversationId: OTHER })).toBe(true);
    expect(messagingIsOffered({ recipientUserId: ID, status: "signin", conversationId: null })).toBe(false);
    expect(messagingIsOffered({ recipientUserId: ID, status: "not_accepting", conversationId: null })).toBe(false);
    expect(messagingIsOffered(null)).toBe(false);
  });
});

describe("links in text", () => {
  it("splits text and links, trimming trailing punctuation", () => {
    expect(splitMessageText("See https://example.com/a, ok.")).toEqual([
      { type: "text", value: "See " },
      { type: "link", href: "https://example.com/a", label: "https://example.com/a", host: "example.com", external: true },
      { type: "text", value: ", ok." },
    ]);
  });

  it("adds a scheme to www links", () => {
    const parts = splitMessageText("go www.example.org/x");
    expect(parts[1]).toMatchObject({ href: "https://www.example.org/x", host: "example.org", external: true });
  });

  it("treats this site's links as internal", () => {
    const parts = splitMessageText("my profile: https://searchtalent.dev/u/olena");
    expect(parts[1]).toMatchObject({ external: false });
    expect(isSiteHost("www.searchtalent.com.ua")).toBe(true);
    expect(isSiteHost("searchtalent.dev.evil.com")).toBe(false);
    expect(isSiteHost("preview.example.app", ["preview.example.app"])).toBe(true);
  });

  it("keeps plain text whole", () => {
    expect(splitMessageText("no links here")).toEqual([{ type: "text", value: "no links here" }]);
    expect(splitMessageText("")).toEqual([]);
  });

  it("never turns other schemes into links", () => {
    expect(splitMessageText("javascript:alert(1)")).toEqual([{ type: "text", value: "javascript:alert(1)" }]);
    expect(splitMessageText("data:text/html,<b>x</b>").every((part) => part.type === "text")).toBe(true);
    expect(safeMessageUrl("javascript:alert(1)")).toBeNull();
    expect(safeMessageUrl("data:text/html,x")).toBeNull();
    expect(safeMessageUrl("not a url")).toBeNull();
    expect(safeMessageUrl("https://example.com/a")?.href).toBe("https://example.com/a");
  });

  it("renders the parsed href, not the typed text", () => {
    const parts = splitMessageText("x https://Example.com");
    expect(parts[1]).toMatchObject({ href: "https://example.com/", label: "https://Example.com" });
  });

  it("mirrors the request rule on outside links", () => {
    expect(hasExternalLink("Hello, I liked your project")).toBe(false);
    expect(hasExternalLink("https://searchtalent.dev/jobs/x")).toBe(false);
    expect(hasExternalLink("https://example.com")).toBe(true);
    expect(hasExternalLink("пишіть t.me/scammer")).toBe(true);
    expect(hasExternalLink("wa.me/123")).toBe(true);
    expect(hasExternalLink("edit.me/now")).toBe(false);
  });
});

describe("order and read receipts", () => {
  it("groups by the day in a given time zone", () => {
    expect(messageDayKey("2026-10-10T22:30:00Z", "UTC")).toBe("2026-10-10");
    expect(messageDayKey("2026-10-10T22:30:00Z", "Europe/Kyiv")).toBe("2026-10-11");
    expect(messageDayKey("not a date")).toBe("");
  });

  it("merges without duplicates, in seq order", () => {
    const merged = mergeMessages([message(1), message(3)], [message(2), { ...message(3), body: "edited" }]);
    expect(merged.map((item) => item.seq)).toEqual([1, 2, 3]);
    expect(merged[2].body).toBe("edited");
  });

  it("finds the last own message the other side read", () => {
    const messages = [
      message(1, { fromMySide: true }),
      message(2),
      message(3, { fromMySide: true }),
      message(4, { fromMySide: true }),
    ];
    expect(lastReadOwnMessageId(messages, 3)).toBe("m3");
    expect(lastReadOwnMessageId(messages, 10)).toBe("m4");
    expect(lastReadOwnMessageId(messages, 0)).toBeNull();
    expect(lastReadOwnMessageId(messages, null)).toBeNull();
  });

  it("makes a v4 uuid for each send", () => {
    const first = newClientId();
    expect(isUuid(first)).toBe(true);
    expect(first.charAt(14)).toBe("4");
    expect(newClientId()).not.toBe(first);
  });
});

describe("editing and deleting (13.3)", () => {
  it("reads who removed a message and until when it can be edited", () => {
    const own = normalizeMessageRow({ id: "m1", seq: 1, body: "hi", mine: true, editable_until: "2026-10-11T10:15:00Z" });
    expect(own?.editableUntil).toBe("2026-10-11T10:15:00Z");
    expect(own?.removedBy).toBeNull();
    expect(normalizeMessageRow({ id: "m2", seq: 2, body: "", removed: true, removed_by: "author" })?.removedBy).toBe("author");
    expect(normalizeMessageRow({ id: "m3", seq: 3, body: "", removed: true, removed_by: "moderator" })?.removedBy).toBe("moderator");
    // An older database that does not say: a moderator's removal, the stricter wording.
    expect(normalizeMessageRow({ id: "m4", seq: 4, body: "", removed: true })?.removedBy).toBe("moderator");
    const row = normalizeConversationRow({
      id: ID,
      last_message: { id: "m2", seq: 2, kind: "text", body: "", removed: true, removedBy: "author" },
    });
    expect(row?.lastMessage?.removedBy).toBe("author");
  });

  it("offers editing only before the moment the database gave", () => {
    const now = Date.parse("2026-10-11T10:10:00Z");
    expect(canEditMessage({ editableUntil: "2026-10-11T10:15:00Z" }, now)).toBe(true);
    expect(canEditMessage({ editableUntil: "2026-10-11T10:05:00Z" }, now)).toBe(false);
    expect(canEditMessage({ editableUntil: null }, now)).toBe(false);
    expect(canEditMessage({ editableUntil: "nonsense" }, now)).toBe(false);
  });
});

describe("search (13.3)", () => {
  it("normalizes a message hit and a name hit", () => {
    const hit = normalizeSearchResult({
      conversation_id: ID,
      kind: "direct",
      side: "self",
      counterpart: { userId: OTHER, username: "bob", available: true },
      company: null,
      message_id: "m9",
      seq: "42",
      snippet: "…the needle here",
      from_my_side: true,
      created_at: "2026-10-11T09:00:00Z",
    });
    expect(hit).toMatchObject({ conversationId: ID, messageId: "m9", seq: 42, snippet: "…the needle here", fromMySide: true });
    expect(hit?.counterpart?.username).toBe("bob");

    const name = normalizeSearchResult({ conversation_id: ID, kind: "company", side: "person", message_id: null, seq: null, snippet: null });
    expect(name).toMatchObject({ messageId: null, seq: null, snippet: null, kind: "company", side: "person" });
    expect(normalizeSearchResult({ message_id: "m1" })).toBeNull();
    expect(normalizeSearchResult(null)).toBeNull();
  });

  it("highlights every match, whatever the case, without markup", () => {
    expect(splitHighlight("Hello hello HELLO", "hello")).toEqual([
      { text: "Hello", match: true },
      { text: " ", match: false },
      { text: "hello", match: true },
      { text: " ", match: false },
      { text: "HELLO", match: true },
    ]);
    expect(splitHighlight("Привіт, Олено", "олен")).toEqual([
      { text: "Привіт, ", match: false },
      { text: "Олен", match: true },
      { text: "о", match: false },
    ]);
    expect(splitHighlight("<b>x</b>", "b")).toEqual([
      { text: "<", match: false },
      { text: "b", match: true },
      { text: ">x</", match: false },
      { text: "b", match: true },
      { text: ">", match: false },
    ]);
    expect(splitHighlight("text", "  ")).toEqual([{ text: "text", match: false }]);
    expect(splitHighlight("", "")).toEqual([]);
  });

  it("squeezes the query and reads it from the address", () => {
    expect(normalizeSearchQuery("  two   words ")).toBe("two words");
    expect(parseSearchParam(" hi ")).toBe("hi");
    expect(parseSearchParam("a")).toBeNull();
    expect(parseSearchParam("x".repeat(101))).toBeNull();
    expect(parseSearchParam(["first", "second"])).toBe("first");
    expect(parseSearchParam(undefined)).toBeNull();
  });

  it("opens a conversation at a message, next to the same list and search", () => {
    expect(parseFocusSeq("42")).toBe(42);
    expect(parseFocusSeq(["7"])).toBe(7);
    expect(parseFocusSeq("0")).toBeNull();
    expect(parseFocusSeq("-3")).toBeNull();
    expect(parseFocusSeq("4x")).toBeNull();
    expect(parseFocusSeq("9".repeat(20))).toBeNull();
    expect(buildMessagesQuery("archived", null, "needle")).toBe("?box=archived&q=needle");
    expect(buildConversationHref(ID, "?q=needle", 42)).toBe(`/messages/${ID}?q=needle&m=42`);
    expect(buildConversationHref(ID, "", null)).toBe(`/messages/${ID}`);
    expect(buildConversationHref(ID, "?box=unread", null)).toBe(`/messages/${ID}?box=unread`);
  });
});

describe("link cards (13.3)", () => {
  it("finds this site's pages that have a card, each once, at most two", () => {
    expect(
      messageLinkTargets(
        "Look https://searchtalent.dev/uk/projects/portfolio and https://searchtalent.dev/en/u/ada, also https://searchtalent.dev/uk/jobs/junior",
      ),
    ).toEqual(["/uk/projects/portfolio", "/en/u/ada"]);
    expect(messageLinkTargets("https://searchtalent.dev/uk/companies/acme https://searchtalent.dev/uk/companies/acme")).toEqual([
      "/uk/companies/acme",
    ]);
    expect(messageLinkTargets("www.searchtalent.dev/jobs/junior-designer/")).toEqual(["/jobs/junior-designer"]);
  });

  it("leaves other sites, lists and editors alone", () => {
    expect(messageLinkTargets("https://example.com/u/ada")).toEqual([]);
    expect(messageLinkTargets("https://searchtalent.dev/uk/jobs")).toEqual([]);
    expect(messageLinkTargets("https://searchtalent.dev/uk/projects/new")).toEqual([]);
    expect(messageLinkTargets("https://searchtalent.dev.evil.com/u/ada")).toEqual([]);
    expect(messageLinkTargets("no links at all")).toEqual([]);
  });

  it("counts the deployment's own host as this site", () => {
    expect(messageLinkTargets("http://localhost:3000/u/ada", ["localhost"])).toEqual(["/u/ada"]);
  });
});

describe("email preferences (13.3)", () => {
  it("normalizes with the defaults", () => {
    expect(normalizeNotificationPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizeNotificationPreferences({ messageEmails: "daily", followerEmails: false })).toEqual({
      messageEmails: "daily",
      followerEmails: false,
    });
    expect(normalizeNotificationPreferences({ messageEmails: "hourly" })).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });
});
