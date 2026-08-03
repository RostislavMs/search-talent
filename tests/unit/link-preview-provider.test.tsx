// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { LinkPreview } from "@/lib/link-preview";

vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

// Set before the provider module is imported: it reads the site hosts once, at
// module scope. jsdom serves the page from localhost, so this is the real
// production shape — authored links point at the canonical domain, not at the
// origin the page happens to be served from.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://searchtalent.dev";
});

import LinkPreviewProvider from "@/components/link-preview-provider";
import { apiFetch } from "@/lib/api-client";

const apiFetchMock = vi.mocked(apiFetch);

function makePreview(overrides: Partial<LinkPreview> = {}): LinkPreview {
  return {
    kind: "profile",
    eyebrow: "Profile",
    title: "Ada Lovelace",
    subtitle: "@ada",
    description: "Systems engineer",
    imageUrl: null,
    imageShape: "avatar",
    badge: "128 score",
    chips: ["Kyiv"],
    ...overrides,
  };
}

function respondWith(preview: LinkPreview | null) {
  apiFetchMock.mockResolvedValue({ ok: true, data: { preview } } as never);
}

/**
 * Each test uses a fresh username so the provider's module-level preview cache
 * (deliberately session-long) cannot leak a result into the next test.
 */
function setup(username: string, extra?: { scoped?: boolean }) {
  const scoped = extra?.scoped ?? true;

  const view = render(
    <div>
      {scoped ? (
        <p data-link-preview-scope="">
          <a href={`/en/u/${username}`}>
            @{username}
          </a>
          {/* Authored article bodies store internal links absolute — the
              rich-text sanitizer strips relative hrefs. */}
          <a href={`${window.location.origin}/en/u/${username}`}>Absolute</a>
          {/* …and they point at the canonical domain, which is not the origin
              serving the page on a preview deploy or a local dev server. */}
          <a href={`https://searchtalent.dev/en/u/${username}`}>Canonical</a>
          {/* Raw anchors on purpose: the provider listens for injected article
              HTML, not for <Link> elements. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/en/talents">All talents</a>
          <a href="https://example.com/u/other">External</a>
        </p>
      ) : (
        <p>
          <a href={`/en/u/${username}`}>@{username}</a>
        </p>
      )}
      <LinkPreviewProvider labels={{ loading: "Loading preview…" }} />
    </div>,
  );

  return { view, link: screen.getByText(`@${username}`) };
}

function hover(element: Element, pointerType = "mouse") {
  const event = new Event("pointerover", { bubbles: true });
  Object.assign(event, { pointerType, clientY: 40 });
  element.dispatchEvent(event);
}

function unhover(element: Element, relatedTarget: Element | null = null) {
  const event = new Event("pointerout", { bubbles: true });
  Object.assign(event, { pointerType: "mouse", relatedTarget });
  element.dispatchEvent(event);
}

/** Runs the open delay and lets the fetch promise settle. */
async function settle(ms = 400) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  respondWith(makePreview());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("LinkPreviewProvider", () => {
  it("renders nothing until a previewable link is hovered", () => {
    setup("ada1");
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("shows the card for a hovered mention after the open delay", async () => {
    const { link } = setup("ada2");

    hover(link);
    // Nothing yet — the delay is what keeps skimming quiet.
    expect(screen.queryByText("Loading preview…")).not.toBeInTheDocument();

    await settle();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("@ada")).toBeInTheDocument();
    expect(screen.getByText("128 score")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/link-preview?href=%2Fen%2Fu%2Fada2&locale=en",
    );
  });

  it("drops the card when the cursor leaves the link", async () => {
    const { link } = setup("ada3");

    hover(link);
    await settle();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    unhover(link);
    await settle();

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("never fires for a link the cursor left before the delay elapsed", async () => {
    const { link } = setup("ada4");

    hover(link);
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    unhover(link);
    await settle();

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("ignores touch pointers — a tap navigates instead", async () => {
    const { link } = setup("ada5");

    hover(link, "touch");
    await settle();

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("stays off entirely on a touch device, focus path included", async () => {
    // Chrome on Android focuses a link when it is tapped, so the focus path
    // needs the device check too — otherwise a card flashes over the content
    // on the way to the next page.
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(hover: none)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    try {
      const { link } = setup("ada15");

      hover(link);
      await act(async () => {
        link.dispatchEvent(new Event("focusin", { bubbles: true }));
        vi.advanceTimersByTime(400);
      });

      expect(apiFetchMock).not.toHaveBeenCalled();
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it("ignores links that did not opt in", async () => {
    const { link } = setup("ada6", { scoped: false });

    hover(link);
    await settle();

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("ignores non-previewable and external links inside a scope", async () => {
    setup("ada7");

    hover(screen.getByText("All talents"));
    hover(screen.getByText("External"));
    await settle();

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("previews a link to the canonical domain from another origin", async () => {
    // The regression this guards: article bodies store links against the
    // canonical domain, so on any host that is not it — a preview deploy, a dev
    // server on production data — every in-article link looked external and no
    // card ever appeared.
    setup("ada14");

    hover(screen.getByText("Canonical"));
    await settle();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/link-preview?href=%2Fen%2Fu%2Fada14&locale=en",
    );
  });

  it("previews a same-origin absolute link, as stored in article bodies", async () => {
    setup("ada13");

    hover(screen.getByText("Absolute"));
    await settle();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    // Normalized to a path before it reaches the API.
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/link-preview?href=%2Fen%2Fu%2Fada13&locale=en",
    );
  });

  it("stays silent when the target is not publicly available", async () => {
    respondWith(null);
    const { link } = setup("ghost1");

    hover(link);
    await settle();

    expect(screen.queryByText("Loading preview…")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("serves a repeat hover from the cache without a second request", async () => {
    const { link } = setup("ada8");

    hover(link);
    await settle();
    unhover(link);
    await settle();

    hover(link);
    await settle();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const { link } = setup("ada9");

    hover(link);
    await settle();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("closes on pointerdown so the click reaches the link", async () => {
    const { link } = setup("ada10");

    hover(link);
    await settle();

    await act(async () => {
      link.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("opens on keyboard focus", async () => {
    const { link } = setup("ada11");

    await act(async () => {
      link.dispatchEvent(new Event("focusin", { bubbles: true }));
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("keeps the panel out of the tab and screen-reader order", async () => {
    const { link } = setup("ada12");

    hover(link);
    await settle();

    const panel = document.querySelector(".link-preview-panel");
    expect(panel).not.toBeNull();
    // Informational only: the link underneath owns every interaction.
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel!.querySelector("a, button")).toBeNull();
  });
});
