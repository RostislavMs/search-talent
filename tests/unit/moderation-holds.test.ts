import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));

import { holdReportedContent } from "@/lib/db/moderation-holds";

const ID = "22222222-2222-4222-8222-222222222222";

function admin(resolve: (call: QueryCall) => QueryResult) {
  holder.admin = createSupabaseMock({ user: null, resolve });
  return holder.admin;
}

afterEach(() => {
  holder.admin = null;
  vi.restoreAllMocks();
});

describe("holdReportedContent", () => {
  it("does nothing without the service key", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await holdReportedContent("project", ID, "note")).toBe(false);
  });

  it.each([
    ["profile", "profiles"],
    ["project", "projects"],
    ["article", "articles"],
  ] as const)("holds a %s in %s, approved ones only", async (type, table) => {
    const mock = admin(() => ({ data: [{ id: ID }] }));
    expect(await holdReportedContent(type, ID, "urgent report")).toBe(true);

    const [call] = mock.calls;
    expect(call).toMatchObject({ table, verb: "update" });
    expect(call.payload).toMatchObject({ moderation_status: "under_review", moderation_note: "urgent report" });
    // A restriction or removal an admin made stays as it is.
    expect(call.filters).toEqual([
      { method: "eq", args: ["id", ID] },
      { method: "or", args: ["moderation_status.is.null,moderation_status.eq.approved"] },
    ]);
  });

  it("says no when nothing matched", async () => {
    admin(() => ({ data: [] }));
    expect(await holdReportedContent("profile", ID, "note")).toBe(false);
  });

  it("says no on a database error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    admin(() => ({ error: { message: "denied" } }));
    expect(await holdReportedContent("article", ID, "note")).toBe(false);
  });
});
