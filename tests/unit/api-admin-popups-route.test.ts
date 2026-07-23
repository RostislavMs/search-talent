import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));

import { POST } from "@/app/api/admin/popups/route";
import { DELETE, PATCH } from "@/app/api/admin/popups/[id]/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const POPUP_ID = "22222222-2222-4222-8222-222222222222";
const adminUser: MockUser = {
  id: ADMIN_ID,
  email_confirmed_at: "2026-01-01T00:00:00Z",
};

function setViewer(user: MockUser, isAdmin: boolean, mock?: SupabaseMock) {
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: user as never,
    isAdmin,
    supabase: (mock?.client ?? {}) as never,
  } as never);
}

function makeMock(
  resolve: (table: string, verb: string) => QueryResult,
): SupabaseMock {
  return createSupabaseMock({ resolve: (c) => resolve(c.table, c.verb) });
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function postReq(body: unknown) {
  return new Request("http://test/api/admin/popups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function patchReq(body: unknown) {
  return new Request("http://test/api/admin/popups/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const delReq = () =>
  new Request("http://test/api/admin/popups/x", { method: "DELETE" });

afterEach(() => vi.clearAllMocks());

describe("POST /api/admin/popups — gate", () => {
  it("401 when unauthenticated", async () => {
    setViewer(null, false);
    expect((await POST(postReq({ kind: "feedback" }))).status).toBe(401);
  });

  it("403 when the caller is not an admin", async () => {
    setViewer(adminUser, false);
    expect((await POST(postReq({ kind: "feedback" }))).status).toBe(403);
  });

  it("400 on an invalid payload (missing kind)", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: null })));
    expect((await POST(postReq({}))).status).toBe(400);
  });

  it("400 on an unsafe CTA link", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: null })));
    const res = await POST(
      postReq({ kind: "message", ctaHref: "javascript:alert(1)" }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/popups — create", () => {
  it("creates a draft popup and returns its id", async () => {
    const mock = makeMock((table, verb) =>
      table === "site_popups" && verb === "insert"
        ? { data: { id: POPUP_ID }, error: null }
        : { error: null },
    );
    setViewer(adminUser, true, mock);

    const res = await POST(postReq({ kind: "feedback" }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(POPUP_ID);

    const insert = mock.calls.find(
      (c) => c.table === "site_popups" && c.verb === "insert",
    );
    expect((insert?.payload as { kind: string }).kind).toBe("feedback");
    // No sibling deactivation when the new popup is a draft.
    expect(
      mock.calls.some((c) => c.verb === "update"),
    ).toBe(false);
  });

  it("deactivates existing active popups before inserting an active one", async () => {
    const mock = makeMock((table, verb) =>
      table === "site_popups" && verb === "insert"
        ? { data: { id: POPUP_ID }, error: null }
        : { error: null },
    );
    setViewer(adminUser, true, mock);

    const res = await POST(
      postReq({ kind: "message", isActive: true, titleEn: "Heads up" }),
    );
    expect(res.status).toBe(200);

    const deactivate = mock.calls.find(
      (c) => c.table === "site_popups" && c.verb === "update",
    );
    expect((deactivate?.payload as { is_active: boolean }).is_active).toBe(
      false,
    );
    expect(deactivate?.filters).toContainEqual({
      method: "eq",
      args: ["is_active", true],
    });
  });
});

describe("PATCH /api/admin/popups/[id]", () => {
  it("400 for a non-uuid id", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: null })));
    expect(
      (await PATCH(patchReq({ isActive: false }), paramsFor("nope"))).status,
    ).toBe(400);
  });

  it("400 on unknown keys (strict schema)", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: null })));
    expect(
      (await PATCH(patchReq({ bogus: 1 }), paramsFor(POPUP_ID))).status,
    ).toBe(400);
  });

  it("deactivates siblings then activates the target", async () => {
    const mock = makeMock(() => ({ error: null }));
    setViewer(adminUser, true, mock);

    const res = await PATCH(patchReq({ isActive: true }), paramsFor(POPUP_ID));
    expect(res.status).toBe(200);

    const updates = mock.calls.filter(
      (c) => c.table === "site_popups" && c.verb === "update",
    );
    // One update deactivates other actives (neq id); one updates the target.
    expect(updates.length).toBe(2);
    expect(updates[0]?.filters).toContainEqual({
      method: "neq",
      args: ["id", POPUP_ID],
    });
    expect(updates[1]?.filters).toContainEqual({
      method: "eq",
      args: ["id", POPUP_ID],
    });
  });

  it("updates the target only when just deactivating", async () => {
    const mock = makeMock(() => ({ error: null }));
    setViewer(adminUser, true, mock);

    const res = await PATCH(patchReq({ isActive: false }), paramsFor(POPUP_ID));
    expect(res.status).toBe(200);

    const updates = mock.calls.filter((c) => c.verb === "update");
    expect(updates.length).toBe(1);
    expect(updates[0]?.filters).toContainEqual({
      method: "eq",
      args: ["id", POPUP_ID],
    });
  });

  it("maps a db error to 400", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: { message: "boom" } })));
    const res = await PATCH(patchReq({ delaySeconds: 3 }), paramsFor(POPUP_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("boom");
  });
});

describe("empty-message activation guard", () => {
  const emptyMessageRow = {
    kind: "message",
    title_en: null,
    title_uk: null,
    body_en: null,
    body_uk: null,
    cta_label_en: null,
    cta_label_uk: null,
  };

  it("POST 400 when creating an active message with no content", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: null })));
    const res = await POST(postReq({ kind: "message", isActive: true }));
    expect(res.status).toBe(400);
  });

  it("PATCH 400 when toggling an empty message popup active", async () => {
    const mock = makeMock((_table, verb) =>
      verb === "select" ? { data: emptyMessageRow } : { error: null },
    );
    setViewer(adminUser, true, mock);
    const res = await PATCH(patchReq({ isActive: true }), paramsFor(POPUP_ID));
    expect(res.status).toBe(400);
    // Must not have activated / deactivated anything.
    expect(mock.calls.some((c) => c.verb === "update")).toBe(false);
  });

  it("PATCH 200 when activating a message popup that has content", async () => {
    const mock = makeMock((_table, verb) =>
      verb === "select"
        ? { data: { ...emptyMessageRow, title_en: "Heads up" } }
        : { error: null },
    );
    setViewer(adminUser, true, mock);
    const res = await PATCH(patchReq({ isActive: true }), paramsFor(POPUP_ID));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/admin/popups/[id]", () => {
  it("403 for a non-admin", async () => {
    setViewer(adminUser, false);
    expect((await DELETE(delReq(), paramsFor(POPUP_ID))).status).toBe(403);
  });

  it("deletes the popup by id", async () => {
    const mock = makeMock(() => ({ error: null }));
    setViewer(adminUser, true, mock);

    const res = await DELETE(delReq(), paramsFor(POPUP_ID));
    expect(res.status).toBe(200);

    const del = mock.calls.find(
      (c) => c.table === "site_popups" && c.verb === "delete",
    );
    expect(del?.filters).toContainEqual({ method: "eq", args: ["id", POPUP_ID] });
  });

  it("maps a db error to 400", async () => {
    setViewer(adminUser, true, makeMock(() => ({ error: { message: "nope" } })));
    expect((await DELETE(delReq(), paramsFor(POPUP_ID))).status).toBe(400);
  });
});
