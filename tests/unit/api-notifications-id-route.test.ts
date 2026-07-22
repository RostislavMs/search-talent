import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/notifications", () => ({ deleteNotification: vi.fn() }));

import { DELETE } from "@/app/api/notifications/[id]/route";
import { deleteNotification } from "@/lib/db/notifications";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTIF_ID = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test/x", { method: "DELETE" });

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("DELETE /api/notifications/[id]", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await DELETE(req(), params(NOTIF_ID))).status).toBe(401);
  });

  it("400 for an invalid id", async () => {
    setUser(authUser);
    expect((await DELETE(req(), params("nope"))).status).toBe(400);
  });

  it("400 when the delete is not authorized/found", async () => {
    setUser(authUser);
    vi.mocked(deleteNotification).mockResolvedValue(false as never);
    expect((await DELETE(req(), params(NOTIF_ID))).status).toBe(400);
  });

  it("deletes the caller's own notification", async () => {
    setUser(authUser);
    vi.mocked(deleteNotification).mockResolvedValue(true as never);
    const res = await DELETE(req(), params(NOTIF_ID));
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteNotification)).toHaveBeenCalledWith(
      expect.anything(),
      { recipientUserId: USER_ID, id: NOTIF_ID },
    );
  });
});
