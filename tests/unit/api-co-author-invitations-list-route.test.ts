import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/co-authors", () => ({ listPendingInvitationsForUser: vi.fn() }));

import { GET } from "@/app/api/co-author-invitations/route";
import { listPendingInvitationsForUser } from "@/lib/db/co-authors";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/co-author-invitations", () => {
  it("returns an empty list for anonymous callers", async () => {
    setUser(null);
    const res = await GET();
    expect((await res.json()).invitations).toEqual([]);
    expect(vi.mocked(listPendingInvitationsForUser)).not.toHaveBeenCalled();
  });

  it("lists pending invitations for the current user", async () => {
    setUser(authUser);
    vi.mocked(listPendingInvitationsForUser).mockResolvedValue([{ id: "inv1" }] as never);
    const res = await GET();
    expect((await res.json()).invitations).toEqual([{ id: "inv1" }]);
    expect(vi.mocked(listPendingInvitationsForUser)).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });
});
