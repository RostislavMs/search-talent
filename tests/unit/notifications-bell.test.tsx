// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NotificationItem } from "@/lib/constants/notifications";

vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/projects" }));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />;
  },
}));
vi.mock("@/components/ui/localized-link", () => ({
  default: ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/button-styles", () => ({ buttonStyles: () => "" }));
vi.mock("@/lib/format-relative-time", () => ({ formatRelativeTime: () => "just now" }));
vi.mock("@/lib/notifications-presentation", () => ({
  buildNotificationHref: (item: NotificationItem) => `/n/${item.id}`,
  describeNotification: () => "did a thing",
  resolveActorName: () => "Alice",
  resolveNotificationEmoji: () => "🔔",
}));
vi.mock("@/lib/i18n/client", () => ({
  useDictionary: () => ({
    notifications: {
      openLabel: "Notifications",
      title: "Notifications",
      markAllRead: "Mark all read",
      loading: "Loading…",
      empty: "Nothing yet",
      openAll: "See all",
    },
  }),
  useLocalizedRouter: () => ({ locale: "en" }),
}));

import NotificationsBell from "@/components/notifications-bell";
import { apiFetch } from "@/lib/api-client";

function makeItem(id: string, readAt: string | null): NotificationItem {
  return {
    id,
    type: "project_comment" as NotificationItem["type"],
    recipientUserId: "r",
    actorUserId: "a",
    targetType: null,
    targetId: null,
    metadata: {},
    readAt,
    createdAt: "2026-07-01T00:00:00Z",
  };
}

/**
 * Route apiFetch by URL + method so a single mock serves the bell's three
 * calls: the unread-count poll, the preview list, and mark-read.
 */
function wireApi(opts: { count?: number; items?: NotificationItem[] } = {}) {
  const count = opts.count ?? 0;
  const items = opts.items ?? [];
  vi.mocked(apiFetch).mockImplementation((async (url: string, init?: { method?: string }) => {
    if (url.startsWith("/api/notifications/unread-count")) {
      return { ok: true, data: { count } };
    }
    if (url.startsWith("/api/notifications/mark-read")) {
      return { ok: true, data: { updated: 1 } };
    }
    if (url.startsWith("/api/notifications")) {
      return { ok: true, data: { notifications: items } };
    }
    void init;
    return { ok: false, status: 404, error: "not found" };
  }) as never);
}

async function openDropdown() {
  const details = document.querySelector("details") as HTMLDetailsElement;
  await act(async () => {
    details.open = true;
    fireEvent(details, new Event("toggle"));
    // Flush the loadPreview() microtask chain so the list is committed.
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});
afterEach(() => cleanup());

describe("<NotificationsBell />", () => {
  it("renders the unread badge from the mount poll", async () => {
    wireApi({ count: 3 });
    render(<NotificationsBell />);
    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith("/api/notifications/unread-count");
  });

  it("caps the badge at 99+", async () => {
    wireApi({ count: 250 });
    render(<NotificationsBell />);
    expect(await screen.findByText("99+")).toBeInTheDocument();
  });

  it("loads the preview list when the dropdown opens", async () => {
    wireApi({ count: 1, items: [makeItem("n1", null)] });
    render(<NotificationsBell />);
    await screen.findByText("1");

    await openDropdown();
    await screen.findByText("did a thing");

    expect(screen.getByText("did a thing")).toBeInTheDocument();
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith("/api/notifications?limit=6");
  });

  it("marks all read: posts {all:true} and clears the badge", async () => {
    wireApi({ count: 2, items: [makeItem("n1", null)] });
    render(<NotificationsBell />);
    await screen.findByText("2");

    await openDropdown();
    await screen.findByText("did a thing");

    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      "/api/notifications/mark-read",
      expect.objectContaining({ method: "POST", body: { all: true } }),
    );
    await waitFor(() => expect(screen.queryByText("2")).not.toBeInTheDocument());
  });

  it("clicking an unread item optimistically decrements and posts its id", async () => {
    wireApi({ count: 2, items: [makeItem("n1", null)] });
    render(<NotificationsBell />);
    await screen.findByText("2");

    await openDropdown();
    await screen.findByText("did a thing");

    await userEvent.click(screen.getByText("did a thing"));

    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      "/api/notifications/mark-read",
      expect.objectContaining({ method: "POST", body: { ids: ["n1"] } }),
    );
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });
});
