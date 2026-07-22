import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/co-authors", () => ({ respondToCoAuthorInvitation: vi.fn() }));

import { PATCH } from "@/app/api/co-author-invitations/[id]/route";
import { respondToCoAuthorInvitation } from "@/lib/db/co-authors";
import { CO_AUTHOR_CONTENT_TYPES } from "@/lib/co-authors";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INV_ID = "22222222-2222-4222-8222-222222222222";
const CONTENT_TYPE = CO_AUTHOR_CONTENT_TYPES[0];

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}

const params = () => ({ params: Promise.resolve({ id: INV_ID }) });
function req(body: unknown) {
  return new Request(`http://test/api/co-author-invitations/${INV_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PATCH /api/co-author-invitations/[id]", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    const res = await PATCH(req({ contentType: CONTENT_TYPE, action: "accept" }), params());
    expect(res.status).toBe(401);
  });

  it("400 for an invalid invitation id", async () => {
    setUser(authUser);
    const res = await PATCH(req({ contentType: CONTENT_TYPE, action: "accept" }), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 for an invalid body (bad action)", async () => {
    setUser(authUser);
    const res = await PATCH(req({ contentType: CONTENT_TYPE, action: "maybe" }), params());
    expect(res.status).toBe(400);
  });

  it("404 when the invitation is missing or already handled", async () => {
    setUser(authUser);
    vi.mocked(respondToCoAuthorInvitation).mockResolvedValue({ ok: false } as never);
    const res = await PATCH(req({ contentType: CONTENT_TYPE, action: "decline" }), params());
    expect(res.status).toBe(404);
  });

  it("accepts the invitation for the current user", async () => {
    setUser(authUser);
    vi.mocked(respondToCoAuthorInvitation).mockResolvedValue({ ok: true, published: false } as never);
    const res = await PATCH(req({ contentType: CONTENT_TYPE, action: "accept" }), params());
    expect(res.status).toBe(200);
    expect(vi.mocked(respondToCoAuthorInvitation)).toHaveBeenCalledWith({
      contentType: CONTENT_TYPE,
      invitationId: INV_ID,
      userId: USER_ID,
      accept: true,
    });
  });
});
