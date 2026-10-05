import { afterEach, describe, expect, it, vi } from "vitest";

// `@/lib/db/co-authors` is a server-only module that talks to Supabase. We stub
// `server-only` (so it can be imported under Node) and mock the three external
// seams: the admin client, notification writes, and publish side-effects.
vi.mock("server-only", () => ({}));

const hoisted = vi.hoisted(() => ({
  adminClient: null as unknown,
  createNotifications: vi.fn(async () => {}),
  dispatchPublishSideEffects: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => hoisted.adminClient,
}));
vi.mock("@/lib/db/notifications", () => ({
  createNotifications: hoisted.createNotifications,
}));
vi.mock("@/lib/db/publish-events", () => ({
  dispatchPublishSideEffects: hoisted.dispatchPublishSideEffects,
}));

import {
  respondToCoAuthorInvitation,
  syncCoAuthors,
} from "@/lib/db/co-authors";

type Filter = { kind: "eq" | "neq" | "in"; col: string; val: unknown };
type Spec = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  count?: boolean;
  head?: boolean;
  single?: boolean;
  payload?: unknown;
  filters: Filter[];
};
type Result = { data?: unknown; error?: unknown; count?: number };

/**
 * Minimal chainable Supabase mock. Each `from()` builds a Spec the test's
 * `handler` resolves; every executed query is recorded on `.calls` for
 * assertions. Supports the subset used by the co-author helpers:
 * select/insert/update/delete + eq/neq/in/order + maybeSingle, awaited directly
 * or via maybeSingle().
 */
function createMockClient(handler: (spec: Spec) => Result) {
  const calls: Spec[] = [];

  function from(table: string) {
    const spec: Spec = { table, op: "select", filters: [] };
    let recorded = false;
    const run = () => {
      if (!recorded) {
        calls.push(spec);
        recorded = true;
      }
      return Promise.resolve(handler(spec) ?? {});
    };

    const builder = {
      select(_arg?: string, opts?: { count?: string; head?: boolean }) {
        if (opts?.count) spec.count = true;
        if (opts?.head) spec.head = true;
        return builder;
      },
      insert(payload: unknown) {
        spec.op = "insert";
        spec.payload = payload;
        return builder;
      },
      update(payload: unknown) {
        spec.op = "update";
        spec.payload = payload;
        return builder;
      },
      delete() {
        spec.op = "delete";
        return builder;
      },
      eq(col: string, val: unknown) {
        spec.filters.push({ kind: "eq", col, val });
        return builder;
      },
      neq(col: string, val: unknown) {
        spec.filters.push({ kind: "neq", col, val });
        return builder;
      },
      in(col: string, val: unknown) {
        spec.filters.push({ kind: "in", col, val });
        return builder;
      },
      order() {
        return builder;
      },
      maybeSingle() {
        spec.single = true;
        return run();
      },
      then(onF: (r: Result) => unknown, onR?: (e: unknown) => unknown) {
        return run().then(onF, onR);
      },
    };
    return builder;
  }

  return { from, calls } as unknown as {
    from: typeof from;
    calls: Spec[];
  };
}

afterEach(() => {
  vi.clearAllMocks();
  hoisted.adminClient = null;
});

describe("respondToCoAuthorInvitation", () => {
  // The database answers in one call (respond_co_author_invite); this checks
  // what the code does with that answer: who is told, and the publish fan-out.
  function rpcClient(row: Record<string, unknown> | null, error: unknown = null) {
    const rpc = vi.fn(async () => ({ data: row, error }));
    return { client: { rpc } as never, rpc };
  }

  const answer = {
    ok: true,
    contentId: "c1",
    ownerId: "owner1",
    title: "Shared project",
    slug: "shared-project",
  };

  function notificationTypes() {
    return hoisted.createNotifications.mock.calls.flatMap((call) => {
      const input = (call as unknown[])[1];
      return (Array.isArray(input) ? input : [input]).map((n) => (n as { type: string }).type);
    });
  }

  it("passes the answer to the database and tells the creator", async () => {
    const { client, rpc } = rpcClient({ ...answer, status: "accepted", published: false });
    hoisted.adminClient = createMockClient(() => ({ data: [] }));

    const result = await respondToCoAuthorInvitation({
      supabase: client,
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(rpc).toHaveBeenCalledWith("respond_co_author_invite", {
      p_content_type: "project",
      p_invitation_id: "inv1",
      p_accept: true,
    });
    expect(result).toEqual({ ok: true, status: "accepted", published: false });
    expect(notificationTypes()).toEqual(["co_author_accepted"]);
    expect(hoisted.dispatchPublishSideEffects).not.toHaveBeenCalled();
  });

  it("fans out once the database published the held draft", async () => {
    const { client } = rpcClient({ ...answer, status: "declined", published: true });
    hoisted.adminClient = createMockClient((spec) =>
      spec.table === "project_authors" ? { data: [{ user_id: "u2" }] } : {},
    );

    const result = await respondToCoAuthorInvitation({
      supabase: client,
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: false,
    });

    expect(result).toEqual({ ok: true, status: "declined", published: true });
    expect(notificationTypes()).toEqual(["co_author_declined", "co_author_published"]);
    expect(hoisted.dispatchPublishSideEffects).toHaveBeenCalledOnce();
  });

  it("does nothing when the invitation is not the caller's or not pending", async () => {
    const { client } = rpcClient({ ok: false });
    hoisted.adminClient = createMockClient(() => ({}));

    const result = await respondToCoAuthorInvitation({
      supabase: client,
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(result).toEqual({ ok: false, status: null, published: false });
    expect(hoisted.createNotifications).not.toHaveBeenCalled();
  });

  it("reports a database error as not handled", async () => {
    const { client } = rpcClient(null, { message: "boom" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await respondToCoAuthorInvitation({
      supabase: client,
      contentType: "poll",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(result.ok).toBe(false);
    spy.mockRestore();
  });
});

describe("syncCoAuthors", () => {
  it("syncs in one database call and notifies only the new invitations", async () => {
    const rpc = vi.fn(async () => ({ data: [{ id: "r3", userId: "new" }], error: null }));
    hoisted.adminClient = {};

    const invited = await syncCoAuthors({
      supabase: { rpc } as never,
      contentType: "project",
      contentId: "c1",
      contentTitle: "Shared",
      contentSlug: "shared",
      creatorUserId: "creator",
      desiredUserIds: ["keep", "new", "creator", "new"],
    });

    expect(rpc).toHaveBeenCalledWith("sync_co_authors", {
      p_content_type: "project",
      p_content_id: "c1",
      p_user_ids: ["keep", "new"],
    });
    expect(invited).toBe(1);
    const [, notifications] = hoisted.createNotifications.mock.calls[0] as unknown as [unknown, Array<{ recipientUserId: string; type: string; metadata: { invitationId: string } }>];
    expect(notifications).toEqual([
      expect.objectContaining({ recipientUserId: "new", type: "co_author_invite", metadata: expect.objectContaining({ invitationId: "r3" }) }),
    ]);
  });

  it("sends nothing when nobody new was invited", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    hoisted.adminClient = {};

    await syncCoAuthors({
      supabase: { rpc } as never,
      contentType: "poll",
      contentId: "c1",
      contentTitle: "Shared",
      contentSlug: "shared",
      creatorUserId: "creator",
      desiredUserIds: ["keep"],
    });

    expect(hoisted.createNotifications).not.toHaveBeenCalled();
  });
});
