// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/messages",
  useRouter: () => router,
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/use-messaging-realtime", () => ({ useMessagingRealtime: vi.fn(() => ({ live: true })) }));

import AdminModerationActions from "@/components/admin-moderation-actions";
import AdminSnapshotMessageRemove from "@/components/admin-snapshot-message-remove";
import ConversationList from "@/components/conversation-list";
import ConversationThread from "@/components/conversation-thread";
import MessageComposeDialog from "@/components/message-compose-dialog";
import MessageComposeForm from "@/components/message-compose-form";
import MessagesNavLink from "@/components/messages-nav-link";
import MessagingRealtimeProvider from "@/components/messaging-realtime-provider";
import EmailSettingsForm from "@/components/email-settings-form";
import MessagingSettingsForm from "@/components/messaging-settings-form";
import ProfileContactButton, { type ProfileContactInfo } from "@/components/profile-contact-button";
import SiteFooterSlot from "@/components/site-footer-slot";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { ChatMessage, ConversationPreview, ConversationView } from "@/lib/messages";
import { getModerationCopy } from "@/lib/moderation-copy";

const uk = dictionaries.uk.messages;
const ukEmails = dictionaries.uk.emailSettings;
const mockedFetch = vi.mocked(apiFetch);
const ME = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const ACME = "44444444-4444-4444-8444-444444444444";

const bob = { userId: BOB, username: "bob", name: "Bob", avatarUrl: null, headline: "Designer", available: true };
const acme = { id: ACME, slug: "acme", name: "Acme", logoUrl: null, verified: false, visible: true };

function preview(patch: Partial<ConversationPreview> = {}): ConversationPreview {
  return {
    id: CONV,
    kind: "direct",
    side: "self",
    state: "open",
    requestToMe: false,
    awaitingReply: false,
    blocked: null,
    counterpart: bob,
    company: null,
    lastMessage: {
      id: "m1",
      seq: 1,
      kind: "text",
      event: null,
      eventData: null,
      body: "Привіт",
      held: false,
      removed: false,
      removedBy: null,
      attachmentCount: 0,
      fromMySide: false,
      mine: false,
      createdAt: "2026-10-10T10:00:00Z",
    },
    lastMessageAt: "2026-10-10T10:00:00Z",
    unreadCount: 0,
    archived: false,
    muted: false,
    ...patch,
  };
}

function view(patch: Partial<ConversationView> = {}): ConversationView {
  return {
    id: CONV,
    kind: "direct",
    side: "self",
    state: "open",
    origin: "direct",
    requestToMe: false,
    awaitingReply: false,
    canSend: true,
    cannotSendReason: null,
    requestRules: false,
    blocked: null,
    counterpart: bob,
    company: null,
    myLastReadSeq: 3,
    theirLastReadSeq: null,
    archived: false,
    muted: false,
    createdAt: "2026-10-10T09:00:00Z",
    applications: [],
    ...patch,
  };
}

function chat(seq: number, patch: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `m${seq}`,
    seq,
    kind: "text",
    event: null,
    eventData: null,
    body: `Повідомлення ${seq}`,
    asCompany: false,
    fromMySide: false,
    mine: false,
    author: bob,
    scamFlag: false,
    held: false,
    removed: false,
    removedBy: null,
    editedAt: null,
    editableUntil: null,
    attachments: [],
    createdAt: "2026-10-10T10:00:00Z",
    ...patch,
  };
}

function renderThread(viewPatch: Partial<ConversationView> = {}, messages: ChatMessage[] = [chat(1)]) {
  return render(
    <ToastProvider>
      <MessagingRealtimeProvider userId={ME}>
        <ConversationThread
          initialView={view(viewPatch)}
          initialMessages={messages}
          locale="uk"
          listQuery=""
          isAuthenticated
        />
      </MessagingRealtimeProvider>
    </ToastProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: {} });
  Element.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConversationList />", () => {
  const scopes = [
    { id: null, name: uk.scopePersonal, unread: 1 },
    { id: ACME, name: "Acme", unread: 2 },
  ];

  it("lists the conversations with their last line and marks", () => {
    render(
      <ConversationList
        initialConversations={[
          preview({ unreadCount: 2 }),
          preview({
            id: "c2",
            kind: "company",
            side: "person",
            counterpart: null,
            company: acme,
            requestToMe: true,
            lastMessage: { ...preview().lastMessage!, body: "Вітаємо", mine: false },
          }),
          preview({ id: "c3", lastMessage: { ...preview().lastMessage!, mine: true, fromMySide: true, body: "Дякую" }, awaitingReply: true }),
        ]}
        box="inbox"
        companyId={null}
        scopes={scopes}
        requestsCount={1}
        locale="uk"
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Bob")).toBeInTheDocument();
    expect(within(items[0]).getByText(uk.unreadCount.replace("{count}", "2"))).toBeInTheDocument();
    expect(within(items[1]).getByText("Acme")).toBeInTheDocument();
    expect(within(items[1]).getByText(uk.requestBadge)).toBeInTheDocument();
    expect(within(items[2]).getByText("Ви: Дякую")).toBeInTheDocument();
    expect(within(items[2]).getByText(uk.waitingReply)).toBeInTheDocument();
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", `/uk/messages/${CONV}`);
    const scopeNav = screen.getByRole("navigation", { name: uk.scopeLabel });
    expect(within(scopeNav).getByRole("link", { name: "Acme 2" })).toHaveAttribute("href", `/uk/messages?company=${ACME}`);
    expect(screen.getByRole("link", { name: `${uk.boxes.requests} 1` })).toHaveAttribute("href", "/uk/messages?box=requests");
  });

  it("hides the requests box in a company inbox and keeps the company in links", () => {
    render(
      <ConversationList
        initialConversations={[preview({ side: "company", kind: "company", company: acme })]}
        box="inbox"
        companyId={ACME}
        activeId={CONV}
        scopes={scopes}
        requestsCount={3}
        locale="uk"
      />,
    );
    expect(screen.queryByRole("link", { name: new RegExp(uk.boxes.requests) })).not.toBeInTheDocument();
    const active = screen.getByRole("link", { current: "page", name: /Bob/ });
    expect(active).toHaveAttribute("href", `/uk/messages/${CONV}?company=${ACME}`);
  });

  it("shows the empty state for the box", () => {
    render(<ConversationList initialConversations={[]} box="requests" companyId={null} scopes={scopes.slice(0, 1)} requestsCount={0} locale="uk" />);
    expect(screen.getByText(uk.empty.requests)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: uk.scopeLabel })).not.toBeInTheDocument();
  });

  it("loads more with the last conversation's time", async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      preview({ id: `c${index}`, lastMessageAt: `2026-10-${String(30 - index).padStart(2, "0")}T10:00:00Z` }),
    );
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { conversations: [preview({ id: "older" })] } });
    render(<ConversationList initialConversations={many} box="inbox" companyId={null} scopes={scopes} requestsCount={0} locale="uk" />);

    await userEvent.click(screen.getByRole("button", { name: uk.loadMore }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(31));
    expect(String(mockedFetch.mock.calls[0][0])).toContain("before=2026-10-01T10%3A00%3A00Z");
  });
});

describe("<MessageComposeForm />", () => {
  it("sends and offers the conversation", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { conversationId: CONV, messageId: "m1", created: true } });
    const onSent = vi.fn();
    render(<MessageComposeForm recipientUserId={BOB} companyId={ACME} onSent={onSent} />);

    expect(screen.getByRole("button", { name: uk.compose.send })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(uk.composer.label), "Добрий день");
    await userEvent.click(screen.getByRole("button", { name: uk.compose.send }));

    await waitFor(() => expect(screen.getByText(uk.compose.sent)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: uk.compose.openConversation })).toHaveAttribute("href", `/uk/messages/${CONV}`);
    const [url, options] = mockedFetch.mock.calls[0];
    expect(url).toBe("/api/messages/conversations");
    expect(options?.body).toMatchObject({ recipientUserId: BOB, body: "Добрий день", companyId: ACME, applicationId: null });
    expect(onSent).toHaveBeenCalledWith(CONV);
  });

  it("says why it was refused", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 403, code: "not_accepting" });
    render(<MessageComposeForm recipientUserId={BOB} />);
    await userEvent.type(screen.getByLabelText(uk.composer.label), "Привіт");
    await userEvent.click(screen.getByRole("button", { name: uk.compose.send }));
    expect(await screen.findByRole("alert")).toHaveTextContent(uk.errors.not_accepting);
  });

  it("warns about an outside link in a request, not in an application answer", async () => {
    const { unmount } = render(<MessageComposeForm recipientUserId={BOB} />);
    await userEvent.type(screen.getByLabelText(uk.composer.label), "див. https://example.com");
    expect(screen.getByText(uk.composer.linkWarning)).toBeInTheDocument();
    expect(screen.getByText(uk.request.rulesHint)).toBeInTheDocument();
    unmount();

    render(<MessageComposeForm recipientUserId={BOB} requestHint={false} />);
    await userEvent.type(screen.getByLabelText(uk.composer.label), "див. https://example.com");
    expect(screen.queryByText(uk.composer.linkWarning)).not.toBeInTheDocument();
  });
});

describe("<MessageComposeDialog />", () => {
  it("opens the form, or links to the existing conversation", async () => {
    const { unmount } = render(
      <MessageComposeDialog recipientUserId={BOB} recipientName="Bob" companyId={ACME} applicationId="a1" vacancyTitle="Дизайнер" />,
    );
    await userEvent.click(screen.getByRole("button", { name: uk.application.write }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(uk.compose.title.replace("{name}", "Bob"))).toBeInTheDocument();
    expect(within(dialog).getByText(uk.compose.aboutApplication.replace("{vacancy}", "Дизайнер"))).toBeInTheDocument();
    expect(within(dialog).queryByText(uk.request.rulesHint)).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    render(<MessageComposeDialog recipientUserId={BOB} recipientName="Bob" companyId={ACME} conversationId={CONV} />);
    expect(screen.getByRole("link", { name: uk.application.open })).toHaveAttribute("href", `/uk/messages/${CONV}`);
  });
});

describe("<ConversationThread />", () => {
  it("shows the messages by day, an event, receipts and warnings", () => {
    const createdAt = new Date().toISOString();
    renderThread({ theirLastReadSeq: 3 }, [
      chat(1, { kind: "event", event: "application", eventData: { applicationId: "a", vacancyId: "v", vacancySlug: "s", vacancyTitle: "Дизайнер", status: "new" }, body: "", author: null, createdAt }),
      chat(2, { scamFlag: true, body: "Оплатіть навчання", createdAt }),
      chat(3, { fromMySide: true, mine: true, body: "Ні, дякую", author: null, createdAt }),
      chat(4, { body: null, held: true, createdAt }),
    ]);

    expect(screen.getByText("Щодо відгуку на «Дизайнер»")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(uk.thread.scamWarning);
    expect(screen.getByText(uk.thread.read)).toBeInTheDocument();
    expect(screen.getByText(uk.thread.held)).toBeInTheDocument();
    expect(screen.getByRole("log")).toBeInTheDocument();
    expect(screen.getAllByText(uk.thread.today).length).toBeGreaterThan(0);
  });

  it("turns links into safe links", () => {
    renderThread({}, [chat(1, { body: "Ось https://example.com/brief." })]);
    const link = screen.getByRole("link", { name: "https://example.com/brief" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "nofollow ugc noopener noreferrer");
  });

  it("sends a message and shows it once saved", async () => {
    mockedFetch.mockImplementation(async (url) => {
      if (String(url).endsWith("/messages")) return { ok: true, data: { messageId: "m9" } };
      if (String(url).startsWith("/api/messages/message/")) {
        return { ok: true, data: { message: { ...chat(9, { fromMySide: true, mine: true, body: "Нове" }), conversationId: CONV } } };
      }
      return { ok: true, data: {} };
    });
    renderThread();

    await userEvent.type(screen.getByLabelText(uk.composer.label), "Нове");
    await userEvent.click(screen.getByRole("button", { name: uk.composer.send }));

    await waitFor(() => expect(screen.getByText("Нове")).toBeInTheDocument());
    expect(screen.queryByText(uk.thread.sending)).not.toBeInTheDocument();
    const sendCall = mockedFetch.mock.calls.find(([url]) => String(url).endsWith("/messages"));
    expect(sendCall?.[1]).toMatchObject({ method: "POST", body: { body: "Нове" } });
  });

  it("keeps a failed message with the reason and a retry", async () => {
    mockedFetch.mockImplementation(async (url) =>
      String(url).endsWith("/messages") ? { ok: false, error: "x", status: 429, code: "rate_limited" } : { ok: true, data: {} },
    );
    renderThread();
    await userEvent.type(screen.getByLabelText(uk.composer.label), "Ще одне");
    await userEvent.click(screen.getByRole("button", { name: uk.composer.send }));

    expect(await screen.findByText(uk.errors.rate_limited)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.thread.retry })).toBeInTheDocument();
  });

  it("offers a request's choices and accepts", async () => {
    renderThread({ requestToMe: true, state: "request" });
    expect(screen.getByText(uk.request.toMeTitle.replace("{name}", "Bob"))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: uk.request.accept }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(`/api/messages/conversations/${CONV}`, { method: "PATCH", body: { action: "accept" } }),
    );
  });

  it("says why one cannot write instead of the box", () => {
    renderThread({ canSend: false, cannotSendReason: "awaiting_reply" });
    expect(screen.queryByLabelText(uk.composer.label)).not.toBeInTheDocument();
    expect(screen.getByText(uk.cannotSend.awaiting_reply)).toBeInTheDocument();
  });

  it("shows the request rules and the link warning while it is still a request", async () => {
    renderThread({ requestRules: true, state: "request" });
    expect(screen.getByText(uk.request.rulesHint)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(uk.composer.label), "t.me/me");
    expect(screen.getByText(uk.composer.linkWarning)).toBeInTheDocument();
  });

  it("blocks after confirming", async () => {
    renderThread();
    await userEvent.click(screen.getByRole("button", { name: uk.menu.label }));
    await userEvent.click(screen.getByRole("menuitem", { name: uk.menu.block }));
    expect(screen.getByRole("dialog")).toHaveTextContent(uk.confirm.blockTitle.replace("{name}", "Bob"));
    await userEvent.click(screen.getByRole("button", { name: uk.confirm.blockConfirm }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(`/api/messages/conversations/${CONV}`, {
        method: "PATCH",
        body: { action: "block", value: true },
      }),
    );
  });

  it("reports the other person once, from the menu, not under each message", async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: {} });
    renderThread({}, [chat(1), chat(2)]);
    const moderation = getModerationCopy("uk");

    expect(screen.queryByRole("button", { name: moderation.report.buttonConversation })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: uk.menu.label }));
    await userEvent.click(screen.getByRole("menuitem", { name: uk.menu.report }));

    const dialog = screen.getByRole("dialog", { name: moderation.report.titleConversation });
    expect(dialog).toHaveTextContent(moderation.report.descriptionConversation);
    await userEvent.click(within(dialog).getByRole("button", { name: moderation.report.submit }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/reports", {
      method: "POST",
      body: { targetType: "conversation", targetId: CONV, reason: "inappropriate_content", details: "" },
    });
    expect(await within(dialog).findByText(moderation.report.success)).toBeInTheDocument();
  });

  it("offers no report once the other side is gone", async () => {
    renderThread({ counterpart: { ...bob, available: false }, canSend: false, cannotSendReason: "closed" });
    await userEvent.click(screen.getByRole("button", { name: uk.menu.label }));
    expect(screen.queryByRole("menuitem", { name: uk.menu.report })).not.toBeInTheDocument();
  });

  it("marks the conversation read when something new from the other side is on screen", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    renderThread({ myLastReadSeq: 1 }, [chat(1), chat(2)]);
    await waitFor(
      () =>
        expect(mockedFetch).toHaveBeenCalledWith(`/api/messages/conversations/${CONV}/read`, {
          method: "POST",
          body: { seq: 2 },
        }),
      { timeout: 2000 },
    );
  });

  it("labels the team's messages for the person", () => {
    renderThread(
      { kind: "company", side: "person", counterpart: null, company: acme },
      [chat(1, { asCompany: true, author: { ...bob, name: "Олена" } })],
    );
    expect(screen.getByText("Олена · Acme")).toBeInTheDocument();
    expect(screen.getByText(uk.thread.unverifiedCompany)).toBeInTheDocument();
  });
});

describe("<MessagingSettingsForm />", () => {
  const settings = { whoCanMessage: "everyone" as const, emailNotifications: true, messageEmails: "instant" as const, readReceipts: true };
  const blocks = [{ id: "b1", byCompany: null, person: bob, company: null, createdAt: "x" }];

  function renderForm() {
    return render(
      <ToastProvider>
        <MessagingSettingsForm initialSettings={settings} initialBlocks={blocks} />
      </ToastProvider>,
    );
  }

  it("saves who can write", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { settings: { ...settings, whoCanMessage: "nobody" } } });
    renderForm();
    await userEvent.click(screen.getByRole("radio", { name: new RegExp(uk.settingsPage.who.nobody.label) }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/messages/settings", { method: "PATCH", body: { whoCanMessage: "nobody" } });
    await waitFor(() => expect(screen.getByRole("radio", { name: new RegExp(uk.settingsPage.who.nobody.label) })).toBeChecked());
  });

  it("chooses how message emails come, on the shared email settings", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { preferences: { messageEmails: "daily", followerEmails: true } } });
    renderForm();
    const group = screen.getByRole("radiogroup", { name: uk.settingsPage.emailTitle });
    await userEvent.click(within(group).getByRole("radio", { name: new RegExp(ukEmails.messageModes.daily.label) }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/email-preferences", { method: "PATCH", body: { messageEmails: "daily" } });
    await waitFor(() =>
      expect(within(group).getByRole("radio", { name: new RegExp(ukEmails.messageModes.daily.label) })).toBeChecked(),
    );
    expect(screen.getByRole("link", { name: uk.settingsPage.allEmails })).toHaveAttribute("href", "/uk/notifications/settings");
  });

  it("puts the email choice back when saving fails", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    renderForm();
    const group = screen.getByRole("radiogroup", { name: uk.settingsPage.emailTitle });
    await userEvent.click(within(group).getByRole("radio", { name: new RegExp(ukEmails.messageModes.off.label) }));
    await waitFor(() =>
      expect(within(group).getByRole("radio", { name: new RegExp(ukEmails.messageModes.instant.label) })).toBeChecked(),
    );
  });

  it("puts the read receipts switch back when saving fails", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    renderForm();
    const receipts = screen.getByRole("switch", { name: uk.settingsPage.receiptsTitle });
    await userEvent.click(receipts);
    await waitFor(() => expect(receipts).toHaveAttribute("aria-checked", "true"));
  });

  it("unblocks", async () => {
    renderForm();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: uk.settingsPage.unblock }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/messages/blocks/b1", { method: "DELETE" });
    await waitFor(() => expect(screen.getByText(uk.settingsPage.blocksEmpty)).toBeInTheDocument());
  });
});

describe("<ProfileContactButton /> messaging", () => {
  const contact: ProfileContactInfo = {
    profileId: "p1",
    displayName: "Bob",
    telegram: null,
    linkedin: null,
    website: null,
    preferred: null,
    hasEmail: false,
    hasPhone: false,
    openToLine: null,
    hourlyRateLine: null,
    workFormatsLine: null,
  };

  it("writes from the dialog", async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: { email: null, phone: null, companies: [] } });
    render(<ProfileContactButton contact={contact} isAuthenticated messaging={{ recipientUserId: BOB, status: "ok", conversationId: null }} />);
    await userEvent.click(screen.getByRole("button", { name: dictionaries.uk.openTo.contact }));
    expect(screen.queryByText(dictionaries.uk.openTo.noChannels)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: uk.contact.write }));
    expect(screen.getByLabelText(uk.composer.label)).toBeInTheDocument();
  });

  it("opens the existing conversation", async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: { email: null, phone: null, companies: [] } });
    render(<ProfileContactButton contact={contact} isAuthenticated messaging={{ recipientUserId: BOB, status: "exists", conversationId: CONV }} />);
    await userEvent.click(screen.getByRole("button", { name: dictionaries.uk.openTo.contact }));
    expect(screen.getByRole("link", { name: uk.contact.open })).toHaveAttribute("href", `/uk/messages/${CONV}`);
  });

  it("asks a guest to sign in, and says when one cannot write", async () => {
    const { unmount } = render(
      <ProfileContactButton contact={contact} isAuthenticated={false} messaging={{ recipientUserId: BOB, status: "signin", conversationId: null }} />,
    );
    await userEvent.click(screen.getByRole("button", { name: dictionaries.uk.openTo.contact }));
    expect(screen.getByRole("link", { name: uk.contact.signIn })).toBeInTheDocument();
    unmount();

    mockedFetch.mockResolvedValue({ ok: true, data: { email: null, phone: null, companies: [] } });
    render(<ProfileContactButton contact={contact} isAuthenticated messaging={{ recipientUserId: BOB, status: "not_accepting", conversationId: null }} />);
    await userEvent.click(screen.getByRole("button", { name: dictionaries.uk.openTo.contact }));
    expect(screen.getByText(uk.contact.unavailable.not_accepting)).toBeInTheDocument();
  });
});

describe("<AdminModerationActions /> for a conversation report", () => {
  const copy = getModerationCopy("uk");

  it("closes the report and limits the person reported", async () => {
    render(<AdminModerationActions copy={copy} targetType="conversation" targetId={CONV} currentStatus={null} reportId="r1" ownerUserId={BOB} />);

    expect(screen.queryByRole("button", { name: copy.actions.saveRemove })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.actions.resolveReport }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/admin/moderation", {
      method: "POST",
      body: {
        targetType: "conversation",
        targetId: CONV,
        moderationStatus: "approved",
        reportId: "r1",
        reportStatus: "resolved",
        resolutionNote: "",
      },
    });

    await userEvent.click(screen.getByRole("button", { name: copy.actions.restrictNew30 }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/admin/messaging-restrictions", {
      method: "POST",
      body: { userId: BOB, scope: "new_conversations", days: 30, note: "", reportId: "r1" },
    });
  });

  it("removes one message from the snapshot", async () => {
    render(<AdminSnapshotMessageRemove messageId="m7" copy={copy} />);
    await userEvent.click(screen.getByRole("button", { name: copy.actions.removeMessage }));
    expect(mockedFetch).toHaveBeenCalledWith("/api/admin/moderation", {
      method: "POST",
      body: { targetType: "message", targetId: "m7", moderationStatus: "removed" },
    });
    expect(await screen.findByText(copy.dashboard.snapshotDeleted)).toBeInTheDocument();
  });
});

describe("the messages screen", () => {
  it("hides the footer so the screen fills the window", () => {
    render(
      <SiteFooterSlot>
        <p>Footer</p>
      </SiteFooterSlot>,
    );
    expect(screen.queryByText("Footer")).not.toBeInTheDocument();
  });
});

describe("<MessagesNavLink />", () => {
  it("shows what is new", () => {
    render(<MessagesNavLink initialCount={3} />);
    const link = screen.getByRole("link", { name: uk.unreadLabel.replace("{count}", "3") });
    expect(link).toHaveAttribute("href", "/uk/messages");
    expect(link).toHaveTextContent("3");
  });

  it("has a plain label without anything new", () => {
    render(<MessagesNavLink />);
    expect(screen.getByRole("link", { name: uk.openLabel })).toBeInTheDocument();
  });
});

describe("<ConversationThread /> own messages (13.3)", () => {
  const inWindow = () => new Date(Date.now() + 10 * 60_000).toISOString();
  const own = (seq: number, patch: Partial<ChatMessage> = {}) =>
    chat(seq, { mine: true, fromMySide: true, author: null, editableUntil: inWindow(), body: `Моє ${seq}`, ...patch });

  it("edits one's own message in its place", async () => {
    mockedFetch.mockImplementation(async (_url: string, options?: { method?: string }) =>
      options?.method === "PATCH"
        ? { ok: true, data: { changed: true, message: own(1, { body: "Виправлене", editedAt: "2026-10-11T10:01:00Z" }) } }
        : { ok: true, data: {} },
    );
    renderThread({}, [own(1)]);

    await userEvent.click(screen.getByRole("button", { name: uk.thread.messageActions }));
    await userEvent.click(screen.getByRole("button", { name: uk.thread.edit }));
    const editor = screen.getByLabelText(uk.thread.editLabel);
    expect(editor).toHaveValue("Моє 1");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Виправлене");
    await userEvent.click(screen.getByRole("button", { name: uk.thread.save }));

    await waitFor(() => expect(screen.getByText("Виправлене")).toBeInTheDocument());
    expect(screen.getByText(uk.thread.edited)).toBeInTheDocument();
    expect(screen.queryByLabelText(uk.thread.editLabel)).not.toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith("/api/messages/message/m1", { method: "PATCH", body: { body: "Виправлене" } });
  });

  it("says why an edit did not go, and Escape leaves the text as it was", async () => {
    mockedFetch.mockImplementation(async (_url: string, options?: { method?: string }) =>
      options?.method === "PATCH" ? { ok: false, error: "x", status: 403, code: "edit_window_passed" } : { ok: true, data: {} },
    );
    renderThread({}, [own(1)]);
    await userEvent.click(screen.getByRole("button", { name: uk.thread.messageActions }));
    await userEvent.click(screen.getByRole("button", { name: uk.thread.edit }));
    await userEvent.type(screen.getByLabelText(uk.thread.editLabel), " ще");
    await userEvent.click(screen.getByRole("button", { name: uk.thread.save }));
    expect(await screen.findByRole("alert")).toHaveTextContent(uk.errors.edit_window_passed);

    await userEvent.type(screen.getByLabelText(uk.thread.editLabel), "{Escape}");
    expect(screen.queryByLabelText(uk.thread.editLabel)).not.toBeInTheDocument();
    expect(screen.getByText("Моє 1")).toBeInTheDocument();
  });

  it("past the 15 minutes only deleting is offered; nothing on others' messages", async () => {
    renderThread({}, [own(1, { editableUntil: "2026-01-01T00:00:00Z" }), chat(2)]);
    expect(screen.getAllByRole("button", { name: uk.thread.messageActions })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: uk.thread.messageActions }));
    expect(screen.queryByRole("button", { name: uk.thread.edit })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: uk.thread.delete })).toBeInTheDocument();
  });

  it("deletes one's own message after asking", async () => {
    mockedFetch.mockImplementation(async (_url: string, options?: { method?: string }) =>
      options?.method === "DELETE"
        ? { ok: true, data: { changed: true, message: own(1, { body: "", removed: true, removedBy: "author", editableUntil: null }) } }
        : { ok: true, data: {} },
    );
    renderThread({}, [own(1)]);
    await userEvent.click(screen.getByRole("button", { name: uk.thread.messageActions }));
    await userEvent.click(screen.getByRole("button", { name: uk.thread.delete }));
    expect(screen.getByText(uk.confirm.deleteMessageTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: uk.confirm.deleteMessageConfirm }));

    await waitFor(() => expect(within(screen.getByRole("log")).getByText(uk.thread.deleted)).toBeInTheDocument());
    expect(mockedFetch).toHaveBeenCalledWith("/api/messages/message/m1", { method: "DELETE" });
    expect(screen.queryByRole("button", { name: uk.thread.messageActions })).not.toBeInTheDocument();
  });

  it("tells a deletion by its author from a moderator's removal", () => {
    renderThread({}, [
      chat(1, { removed: true, removedBy: "author", body: "" }),
      chat(2, { removed: true, removedBy: "moderator", body: "" }),
    ]);
    expect(screen.getByText(uk.thread.deleted)).toBeInTheDocument();
    expect(screen.getByText(uk.thread.removed)).toBeInTheDocument();
  });

  it("shows a card for a link to this site's page", async () => {
    const card = {
      kind: "project",
      eyebrow: "Проєкт",
      title: "Портфоліо Олени",
      subtitle: "Олена",
      description: null,
      imageUrl: null,
      imageShape: "cover",
      badge: null,
      chips: [],
    };
    mockedFetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/link-preview") ? { ok: true, data: { preview: card } } : { ok: true, data: {} },
    );
    renderThread({}, [chat(1, { body: "Гляньте https://searchtalent.dev/en/projects/olena-portfolio і https://example.com" })]);

    const link = await screen.findByRole("link", { name: /Портфоліо Олени/ });
    expect(link).toHaveAttribute("href", "/uk/projects/olena-portfolio");
    const asked = mockedFetch.mock.calls.filter(([url]) => String(url).startsWith("/api/link-preview"));
    expect(asked).toHaveLength(1);
    expect(String(asked[0][0])).toContain(encodeURIComponent("/projects/olena-portfolio"));
  });

  it("opens at a found message and marks it", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <ToastProvider>
        <MessagingRealtimeProvider userId={ME}>
          <ConversationThread
            initialView={view()}
            initialMessages={[chat(1), chat(2), chat(3)]}
            initialHasOlder
            focusSeq={2}
            locale="uk"
            listQuery="?q=needle"
            isAuthenticated
          />
        </MessagingRealtimeProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" }));
    expect(document.getElementById("message-m2")?.innerHTML).toContain("ring-2");
    expect(screen.getByRole("button", { name: uk.thread.loadOlder })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: uk.thread.back })).toHaveAttribute("href", "/uk/messages?q=needle");
  });
});

describe("<ConversationList /> search (13.3)", () => {
  const scopes = [{ id: null, name: uk.scopePersonal, unread: 0 }];
  const results = [
    {
      conversationId: CONV,
      kind: "direct",
      side: "self",
      counterpart: bob,
      company: null,
      messageId: null,
      seq: null,
      snippet: null,
      fromMySide: false,
      createdAt: "2026-10-10T10:00:00Z",
    },
    {
      conversationId: CONV,
      kind: "direct",
      side: "self",
      counterpart: bob,
      company: null,
      messageId: "m7",
      seq: 7,
      snippet: "…знайшла Bob цю голку",
      fromMySide: true,
      createdAt: "2026-10-10T10:00:00Z",
    },
  ];

  it("searches as you type and opens a result at its message", async () => {
    mockedFetch.mockImplementation(async (url: string) =>
      String(url).startsWith("/api/messages/search") ? { ok: true, data: { results } } : { ok: true, data: {} },
    );
    render(<ConversationList initialConversations={[preview()]} box="inbox" companyId={null} scopes={scopes} requestsCount={0} locale="uk" />);

    await userEvent.type(screen.getByRole("searchbox", { name: uk.search.label }), "bob");
    expect(await screen.findByRole("heading", { level: 2, name: uk.search.conversations })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: uk.search.messages })).toBeInTheDocument();
    expect(String(mockedFetch.mock.calls.find(([url]) => String(url).startsWith("/api/messages/search"))?.[0])).toBe(
      "/api/messages/search?q=bob",
    );
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes(CONV));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `/uk/messages/${CONV}?q=bob`,
      `/uk/messages/${CONV}?q=bob&m=7`,
    ]);
    expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
    expect(Array.from(document.querySelectorAll("mark")).every((mark) => /bob/i.test(mark.textContent ?? ""))).toBe(true);
    expect(screen.getByText(new RegExp(uk.search.youPrefix))).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: uk.title })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: uk.search.clear }));
    expect(screen.getByRole("navigation", { name: uk.title })).toBeInTheDocument();
  });

  it("says when nothing is found or the search failed, and keeps a short query out", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { results: [] } });
    render(
      <ConversationList
        initialConversations={[preview()]}
        box="inbox"
        companyId={ACME}
        scopes={scopes}
        requestsCount={0}
        locale="uk"
        initialQuery="голка"
      />,
    );
    expect(await screen.findByText(uk.search.empty)).toBeInTheDocument();
    expect(String(mockedFetch.mock.calls[0][0])).toBe(`/api/messages/search?q=${encodeURIComponent("голка")}&company=${ACME}`);

    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    const box = screen.getByRole("searchbox", { name: uk.search.label });
    await userEvent.type(box, "x");
    expect(await screen.findByText(uk.search.failed)).toBeInTheDocument();

    await userEvent.clear(box);
    await userEvent.type(box, "a");
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});

describe("email settings (13.3)", () => {
  it("turns the follower emails off and puts the switch back on a failure", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: { preferences: { messageEmails: "instant", followerEmails: false } } });
    render(
      <ToastProvider>
        <EmailSettingsForm initialPreferences={{ messageEmails: "instant", followerEmails: true }} />
      </ToastProvider>,
    );
    const followers = screen.getByRole("switch", { name: ukEmails.followersTitle });
    await userEvent.click(followers);
    expect(mockedFetch).toHaveBeenCalledWith("/api/email-preferences", { method: "PATCH", body: { followerEmails: false } });
    await waitFor(() => expect(followers).toHaveAttribute("aria-checked", "false"));

    mockedFetch.mockResolvedValueOnce({ ok: false, error: "x", status: 500 });
    await userEvent.click(followers);
    await waitFor(() => expect(followers).toHaveAttribute("aria-checked", "false"));

    expect(screen.getByRole("radiogroup", { name: ukEmails.messagesTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ukEmails.jobAlertsLink })).toHaveAttribute("href", "/uk/my-space/job-alerts");
  });
});
