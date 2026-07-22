import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({
  listNotifications: vi.fn(async () => []),
  hydrateNotificationActors: vi.fn(async (_c: unknown, items: unknown[]) => items),
  countUnreadNotifications: vi.fn(async () => 0),
  markNotificationsAsRead: vi.fn(async () => 0),
}));

import { GET as listGet } from "@/app/api/notifications/route";
import { GET as unreadGet } from "@/app/api/notifications/unread-count/route";
import { POST as markRead } from "@/app/api/notifications/mark-read/route";
import { rateLimit } from "@/lib/rate-limit";
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationsAsRead,
} from "@/lib/db/notifications";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTIF_ID = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/notifications", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await listGet(new Request("http://test/api/notifications"))).status).toBe(401);
  });

  it("clamps limit to 100 and echoes cursor when a full page is returned", async () => {
    setUser(authUser);
    const page = Array.from({ length: 100 }, (_, i) => ({
      id: `n${i}`,
      createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
    }));
    vi.mocked(listNotifications).mockResolvedValueOnce(page as never);
    const res = await listGet(new Request("http://test/api/notifications?limit=500"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(vi.mocked(listNotifications)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipientUserId: USER_ID, limit: 100 }),
    );
    expect(body.nextCursor).toBe(page[99].createdAt);
  });

  it("returns a null cursor for a short (last) page", async () => {
    setUser(authUser);
    vi.mocked(listNotifications).mockResolvedValueOnce([
      { id: "n1", createdAt: "2026-01-01T00:00:00Z" },
    ] as never);
    const res = await listGet(new Request("http://test/api/notifications"));
    expect((await res.json()).nextCursor).toBeNull();
  });

  it("passes the `before` cursor through", async () => {
    setUser(authUser);
    await listGet(new Request("http://test/api/notifications?before=2026-05-01T00:00:00Z"));
    expect(vi.mocked(listNotifications)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ before: "2026-05-01T00:00:00Z" }),
    );
  });
});

describe("GET /api/notifications/unread-count", () => {
  it("returns 0 for anonymous viewers without querying", async () => {
    setUser(null);
    const res = await unreadGet();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0 });
    expect(vi.mocked(countUnreadNotifications)).not.toHaveBeenCalled();
  });

  it("returns the count with a no-store cache header", async () => {
    setUser(authUser);
    vi.mocked(countUnreadNotifications).mockResolvedValueOnce(7 as never);
    const res = await unreadGet();
    expect(await res.json()).toEqual({ count: 7 });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("POST /api/notifications/mark-read", () => {
  const req = (body: unknown) =>
    new Request("http://test/api/notifications/mark-read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await markRead(req({ all: true }))).status).toBe(401);
  });

  it("429 when rate limited", async () => {
    setUser(authUser);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await markRead(req({ all: true }))).status).toBe(429);
  });

  it("400 on an invalid body", async () => {
    setUser(authUser);
    expect((await markRead(req({ ids: ["not-a-uuid"] }))).status).toBe(400);
    expect(vi.mocked(markNotificationsAsRead)).not.toHaveBeenCalled();
  });

  it("marks the caller's notifications and returns the updated count", async () => {
    setUser(authUser);
    vi.mocked(markNotificationsAsRead).mockResolvedValueOnce(3 as never);
    const res = await markRead(req({ ids: [NOTIF_ID] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 3 });
    expect(vi.mocked(markNotificationsAsRead)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipientUserId: USER_ID, ids: [NOTIF_ID] }),
    );
  });
});
