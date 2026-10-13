// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/messages",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/use-messaging-realtime", () => ({ useMessagingRealtime: vi.fn(() => ({ live: true })) }));
vi.mock("@/lib/storage/upload-with-progress", () => ({
  uploadWithProgress: vi.fn(async ({ onProgress }: { onProgress?: (p: { loaded: number; total: number; percent: number }) => void }) => {
    onProgress?.({ loaded: 1, total: 1, percent: 100 });
  }),
}));
// The browser cannot re-encode in jsdom: images pass through as they are.
vi.mock("@/lib/image-compression", () => ({ compressImageFile: vi.fn(async (file: File) => file) }));

import ConversationThread from "@/components/conversation-thread";
import MessageAttachments, { AttachmentDrafts } from "@/components/message-attachments";
import MessagingRealtimeProvider from "@/components/messaging-realtime-provider";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { MessageAttachment } from "@/lib/message-attachments";
import type { ChatMessage, ConversationView } from "@/lib/messages";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";
import type { AttachmentDraft } from "@/lib/use-message-attachments";

const uk = dictionaries.uk.messages;
const mockedFetch = vi.mocked(apiFetch);
const ME = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CONV = "33333333-3333-4333-8333-333333333333";
const FILE_ID = "55555555-5555-4555-8555-555555555555";
const bob = { userId: BOB, username: "bob", name: "Bob", avatarUrl: null, headline: null, available: true };

const pdf: MessageAttachment = { id: "f1", name: "cv.pdf", type: "application/pdf", size: 2048, width: null, height: null };
const photo: MessageAttachment = { id: "f2", name: "shot.webp", type: "image/webp", size: 5000, width: 1200, height: 800 };

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
    createdAt: "2026-10-12T09:00:00Z",
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
    createdAt: "2026-10-12T10:00:00Z",
    ...patch,
  };
}

function renderThread(viewPatch: Partial<ConversationView> = {}, messages: ChatMessage[] = [chat(1)], filesEnabled = true) {
  return render(
    <ToastProvider>
      <MessagingRealtimeProvider userId={ME}>
        <ConversationThread
          initialView={view(viewPatch)}
          initialMessages={messages}
          locale="uk"
          listQuery=""
          isAuthenticated
          filesEnabled={filesEnabled}
        />
      </MessagingRealtimeProvider>
    </ToastProvider>,
  );
}

const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: {} });
  Element.prototype.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<MessageAttachments />", () => {
  it("shows an image as a picture and a PDF as a card, both through our route", () => {
    render(<MessageAttachments attachments={[photo, pdf]} locale="uk" alignEnd={false} />);

    const image = screen.getByRole("img", { name: "shot.webp" });
    expect(image).toHaveAttribute("src", "/api/messages/attachments/f2");
    expect(image).toHaveAttribute("width", "1200");
    expect(screen.getByRole("link", { name: uk.files.open.replace("{name}", "shot.webp") })).toHaveAttribute(
      "href",
      "/api/messages/attachments/f2",
    );

    const card = screen.getByRole("link", { name: uk.files.open.replace("{name}", "cv.pdf") });
    expect(card).toHaveAttribute("href", "/api/messages/attachments/f1");
    expect(card).toHaveAttribute("target", "_blank");
    expect(within(card).getByText("PDF · 2 КБ")).toBeInTheDocument();
  });

  it("a picture that cannot load says so", async () => {
    render(<MessageAttachments attachments={[photo]} locale="uk" alignEnd />);
    screen.getByRole("img", { name: "shot.webp" }).dispatchEvent(new Event("error"));
    expect(await screen.findByText(uk.files.unavailable)).toBeInTheDocument();
  });

  it("nothing for no files", () => {
    const { container } = render(<MessageAttachments attachments={[]} locale="uk" alignEnd />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("<AttachmentDrafts />", () => {
  const draft = (patch: Partial<AttachmentDraft>): AttachmentDraft => ({
    key: "k1",
    name: "cv.pdf",
    type: "application/pdf",
    size: 10,
    previewUrl: null,
    status: "ready",
    progress: 100,
    attachmentId: FILE_ID,
    error: null,
    ...patch,
  });

  it("says how each upload goes, and lets one go or try again", async () => {
    const onRemove = vi.fn();
    const onRetry = vi.fn();
    render(
      <AttachmentDrafts
        drafts={[
          draft({ key: "a", status: "uploading", progress: 40 }),
          draft({ key: "b", name: "bad.pdf", status: "failed", error: "file_mismatch" }),
          draft({ key: "c", name: "ok.pdf" }),
        ]}
        onRemove={onRemove}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText(uk.files.uploading.replace("{progress}", "40"))).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(uk.errors.file_mismatch);
    await userEvent.click(screen.getByRole("button", { name: uk.files.retry }));
    expect(onRetry).toHaveBeenCalledWith("b");
    await userEvent.click(screen.getByRole("button", { name: uk.files.remove.replace("{name}", "ok.pdf") }));
    expect(onRemove).toHaveBeenCalledWith("c");
  });
});

describe("files in a conversation", () => {
  it("a paperclip only in an open conversation, with the private storage set up", () => {
    renderThread();
    expect(screen.getByRole("button", { name: uk.files.attach })).toBeInTheDocument();
    cleanup();
    renderThread({ state: "request", requestToMe: true });
    expect(screen.queryByRole("button", { name: uk.files.attach })).not.toBeInTheDocument();
    cleanup();
    renderThread({ requestRules: true });
    expect(screen.queryByRole("button", { name: uk.files.attach })).not.toBeInTheDocument();
    cleanup();
    renderThread({}, [chat(1)], false);
    expect(screen.queryByRole("button", { name: uk.files.attach })).not.toBeInTheDocument();
  });

  it("a message of files alone has no empty bubble", () => {
    renderThread({}, [chat(1, { body: "", attachments: [pdf] }), chat(2, { body: "Мій лист", attachments: [photo] })]);
    expect(screen.getByRole("link", { name: uk.files.open.replace("{name}", "cv.pdf") })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "shot.webp" })).toBeInTheDocument();
    expect(screen.getByText("Мій лист")).toBeInTheDocument();
    const first = document.getElementById("message-m1")!;
    expect(first.querySelector(".rounded-2xl.px-3\\.5")).toBeNull();
  });

  it("uploads a picked file, then sends it without text", async () => {
    mockedFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url === `/api/messages/conversations/${CONV}/attachments`) {
        return { ok: true, data: { attachmentId: FILE_ID, uploadUrl: "https://bucket.test/put" } };
      }
      if (url === `/api/messages/conversations/${CONV}/attachments/${FILE_ID}` && options?.method === "POST") {
        return { ok: true, data: { ok: true } };
      }
      if (url === `/api/messages/conversations/${CONV}/messages` && options?.method === "POST") {
        return { ok: true, data: { messageId: "m9" } };
      }
      return { ok: true, data: {} };
    });

    const { container } = renderThread();
    const user = userEvent.setup();
    await user.upload(fileInput(container), new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${CONV}/attachments/${FILE_ID}`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(mockedFetch).toHaveBeenCalledWith(
      `/api/messages/conversations/${CONV}/attachments`,
      expect.objectContaining({ method: "POST", body: expect.objectContaining({ fileName: "cv.pdf", contentType: "application/pdf", size: 8 }) }),
    );
    expect(uploadWithProgress).toHaveBeenCalledWith(expect.objectContaining({ url: "https://bucket.test/put", contentType: "application/pdf" }));

    const send = screen.getByRole("button", { name: uk.composer.send });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        `/api/messages/conversations/${CONV}/messages`,
        expect.objectContaining({ method: "POST", body: expect.objectContaining({ body: "", attachmentIds: [FILE_ID] }) }),
      ),
    );
    expect(screen.queryByRole("list", { name: uk.files.attach })).not.toBeInTheDocument();
  });

  it("refuses a file it cannot send, before uploading", async () => {
    const { container } = renderThread();
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(fileInput(container), new File(["GIF89a"], "cat.gif", { type: "image/gif" }));
    expect(
      await screen.findByText(uk.files.rejected.replace("{name}", "cat.gif").replace("{reason}", uk.errors.file_type)),
    ).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalledWith(`/api/messages/conversations/${CONV}/attachments`, expect.anything());
  });

  it("a refused upload shows why, and taking it out tells nobody (it has no id)", async () => {
    mockedFetch.mockImplementation(async (url: string) =>
      url === `/api/messages/conversations/${CONV}/attachments`
        ? { ok: false, error: "x", status: 429, code: "file_rate_limited" }
        : { ok: true, data: {} },
    );
    const { container } = renderThread();
    const user = userEvent.setup();
    await user.upload(fileInput(container), new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(uk.errors.file_rate_limited);
    await user.click(screen.getByRole("button", { name: uk.files.remove.replace("{name}", "cv.pdf") }));
    expect(screen.queryByText("cv.pdf")).not.toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalledWith(expect.stringContaining("/attachments/"), expect.objectContaining({ method: "DELETE" }));
  });

  it("taking out an uploaded file tells the server", async () => {
    mockedFetch.mockImplementation(async (url: string) =>
      url === `/api/messages/conversations/${CONV}/attachments`
        ? { ok: true, data: { attachmentId: FILE_ID, uploadUrl: "https://bucket.test/put" } }
        : { ok: true, data: {} },
    );
    const { container } = renderThread();
    const user = userEvent.setup();
    await user.upload(fileInput(container), new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByRole("button", { name: uk.composer.send })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: uk.files.remove.replace("{name}", "cv.pdf") }));
    expect(mockedFetch).toHaveBeenCalledWith(`/api/messages/conversations/${CONV}/attachments/${FILE_ID}`, { method: "DELETE" });
  });
});
