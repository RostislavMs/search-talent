// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/uk/my-space",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import ProfileShareDialog from "@/components/profile-share-dialog";
import ProfileSharePanel, { buildPortfolioPost } from "@/components/profile-share-panel";
import { ToastProvider } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { dictionaries } from "@/lib/i18n/dictionaries";

const uk = dictionaries.uk;
const en = dictionaries.en;
const mockedFetch = vi.mocked(apiFetch);
const PROFILE_URL = "https://searchtalent.dev/u/olena.koval";

function sharedCalls() {
  return mockedFetch.mock.calls.filter(
    ([url, options]) =>
      url === "/api/onboarding" &&
      (options?.body as { action?: string } | undefined)?.action === "link_shared",
  );
}

function renderPanel(props: Partial<Parameters<typeof ProfileSharePanel>[0]> = {}) {
  return render(
    <ToastProvider>
      <ProfileSharePanel profileUrl={PROFILE_URL} username="olena.koval" {...props} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  mockedFetch.mockResolvedValue({ ok: true, data: {} } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("buildPortfolioPost", () => {
  it("adds what the author is open to, in both languages", () => {
    expect(buildPortfolioPost([], uk)).toBe(uk.profileShare.postTemplate);
    expect(buildPortfolioPost(["freelance", "internship"], uk)).toBe(
      `${uk.profileShare.postTemplate}\nВідкрито до фрилансу, стажування. Пишіть, якщо маєте пропозицію.`,
    );
    expect(buildPortfolioPost(["job"], en)).toBe(
      `${en.profileShare.postTemplate}\nOpen to a job. Message me if you have an offer.`,
    );
  });
});

describe("<ProfileSharePanel />", () => {
  it("prefills the post and passes it to Telegram and X, not the link twice", () => {
    renderPanel({ openTo: ["freelance"] });

    const post = screen.getByLabelText(uk.profileShare.postLabel) as HTMLTextAreaElement;
    expect(post.value).toContain("Відкрито до фрилансу");

    const telegram = screen.getByRole("link", { name: /Telegram/ });
    const href = new URL(telegram.getAttribute("href") ?? "");
    expect(href.searchParams.get("url")).toBe(PROFILE_URL);
    expect(href.searchParams.get("text")).toBe(post.value);
    expect(href.searchParams.get("text")).not.toContain(PROFILE_URL);
    expect(
      new URL(screen.getByRole("link", { name: /^X$/ }).getAttribute("href") ?? "").searchParams.get(
        "text",
      ),
    ).toBe(post.value);
  });

  it("uses the edited post everywhere", async () => {
    const user = userEvent.setup();
    renderPanel();

    const post = screen.getByLabelText(uk.profileShare.postLabel);
    await user.clear(post);
    await user.type(post, "Нові роботи");

    const telegram = screen.getByRole("link", { name: /Telegram/ });
    expect(new URL(telegram.getAttribute("href") ?? "").searchParams.get("text")).toBe("Нові роботи");

    await user.click(screen.getByRole("button", { name: uk.profileShare.copyPost }));
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(`Нові роботи\n${PROFILE_URL}`),
    );
  });

  it("copies the post for LinkedIn, which takes only the link", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("link", { name: /LinkedIn/ }));

    expect(await screen.findByText(uk.profileShare.postCopied)).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(uk.profileShare.postTemplate);
  });

  it("copies the clean link, while the QR code and badge carry their tags", async () => {
    const user = userEvent.setup();
    renderPanel({ showBadge: true });

    await user.click(screen.getByRole("button", { name: uk.profileShare.copy }));
    expect(await navigator.clipboard.readText()).toBe(PROFILE_URL);

    expect(screen.getByRole("img", { name: uk.profileShare.badgeAlt })).toHaveAttribute(
      "src",
      "https://searchtalent.dev/api/badge/olena.koval.svg",
    );
    const snippet = screen.getByRole("textbox", {
      name: uk.profileShare.badgeSnippetLabel,
    }) as HTMLInputElement;
    const markdown =
      "[![SearchTalent portfolio](https://searchtalent.dev/api/badge/olena.koval.svg)](https://searchtalent.dev/u/olena.koval?utm_source=badge&utm_medium=portfolio)";
    expect(snippet.value).toBe(markdown);

    await user.click(
      screen.getByRole("button", { name: `${uk.profileShare.copy}: ${uk.profileShare.badgeSnippetLabel}` }),
    );
    expect(await navigator.clipboard.readText()).toBe(markdown);
    expect(
      screen.getByRole("img", { name: /QR-код для searchtalent\.dev\/u\/olena\.koval/ }),
    ).toBeInTheDocument();
  });

  it("hides the badge unless asked", () => {
    renderPanel();
    expect(screen.queryByText(uk.profileShare.badgeTitle)).toBeNull();
  });

  it("records the first share once and skips it when already done", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPanel();

    await user.click(screen.getByRole("button", { name: uk.profileShare.copy }));
    await user.click(screen.getByRole("link", { name: /Telegram/ }));
    expect(sharedCalls()).toHaveLength(1);
    unmount();

    mockedFetch.mockClear();
    renderPanel({ alreadyShared: true });
    await user.click(screen.getByRole("link", { name: /Telegram/ }));
    expect(sharedCalls()).toHaveLength(0);
  });

  it("hands the record to the caller when it keeps track itself", async () => {
    const user = userEvent.setup();
    const onShared = vi.fn();
    renderPanel({ onShared });

    await user.click(screen.getByRole("link", { name: /Telegram/ }));
    expect(onShared).toHaveBeenCalledTimes(1);
    expect(sharedCalls()).toHaveLength(0);
  });
});

describe("<ProfileShareDialog />", () => {
  it("opens the full panel with the badge and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ProfileShareDialog profileUrl={PROFILE_URL} username="olena.koval" openTo={[]} />
      </ToastProvider>,
    );

    const trigger = screen.getByRole("button", { name: uk.profileShare.button });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: uk.profileShare.dialogTitle });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(uk.profileShare.badgeTitle)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
