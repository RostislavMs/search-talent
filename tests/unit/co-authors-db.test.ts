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

const hasEq = (spec: Spec, col: string, val: unknown) =>
  spec.filters.some((f) => f.kind === "eq" && f.col === col && f.val === val);

afterEach(() => {
  vi.clearAllMocks();
  hoisted.adminClient = null;
});

describe("respondToCoAuthorInvitation", () => {
  const baseInvite = {
    id: "inv1",
    user_id: "u1",
    status: "pending",
    project_id: "c1",
  };
  const draftContent = {
    id: "c1",
    title: "Shared project",
    slug: "shared-project",
    status: "draft",
    publish_on_confirm: true,
    owner_id: "owner1",
  };

  function handlerFor(opts: {
    invite?: Record<string, unknown> | null;
    content?: Record<string, unknown> | null;
    pendingCount?: number;
    accepted?: Array<{ user_id: string }>;
  }) {
    return (spec: Spec): Result => {
      if (spec.table === "project_authors") {
        if (spec.op === "select" && spec.single) {
          return { data: opts.invite ?? baseInvite };
        }
        if (spec.op === "select" && spec.count && spec.head) {
          return { count: opts.pendingCount ?? 0 };
        }
        if (spec.op === "select" && hasEq(spec, "status", "accepted")) {
          return { data: opts.accepted ?? [{ user_id: "u1" }] };
        }
        return { error: null }; // update / delete
      }
      if (spec.table === "projects") {
        if (spec.op === "select") return { data: opts.content ?? draftContent };
        return { error: null }; // publish update
      }
      return {};
    };
  }

  it("publishes a held draft when the last pending invite is accepted", async () => {
    const client = createMockClient(handlerFor({ pendingCount: 0 }));
    hoisted.adminClient = client;

    const result = await respondToCoAuthorInvitation({
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(result).toEqual({ ok: true, status: "accepted", published: true });

    // The content was flipped to published.
    const publishUpdate = client.calls.find(
      (c) => c.table === "projects" && c.op === "update",
    );
    expect(publishUpdate?.payload).toMatchObject({ status: "published" });

    // Creator notified of acceptance + co-authors notified of publish.
    const types = hoisted.createNotifications.mock.calls.flatMap((call) => {
      const input = (call as unknown[])[1];
      return (Array.isArray(input) ? input : [input]).map(
        (n) => (n as { type: string }).type,
      );
    });
    expect(types).toContain("co_author_accepted");
    expect(types).toContain("co_author_published");
    expect(hoisted.dispatchPublishSideEffects).toHaveBeenCalledOnce();
  });

  it("does not publish while other invites are still pending", async () => {
    const client = createMockClient(handlerFor({ pendingCount: 2 }));
    hoisted.adminClient = client;

    const result = await respondToCoAuthorInvitation({
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(result.published).toBe(false);
    expect(
      client.calls.some((c) => c.table === "projects" && c.op === "update"),
    ).toBe(false);
    expect(hoisted.dispatchPublishSideEffects).not.toHaveBeenCalled();
  });

  it("rejects a response from a user who does not own the invitation", async () => {
    const client = createMockClient(
      handlerFor({ invite: { ...baseInvite, user_id: "someone-else" } }),
    );
    hoisted.adminClient = client;

    const result = await respondToCoAuthorInvitation({
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(result).toEqual({ ok: false, status: null, published: false });
    // No mutation happened.
    expect(client.calls.some((c) => c.op === "update")).toBe(false);
    expect(hoisted.createNotifications).not.toHaveBeenCalled();
  });

  it("ignores an invitation that is no longer pending", async () => {
    const client = createMockClient(
      handlerFor({ invite: { ...baseInvite, status: "accepted" } }),
    );
    hoisted.adminClient = client;

    const result = await respondToCoAuthorInvitation({
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: true,
    });

    expect(result.ok).toBe(false);
  });

  it("declining the last pending invite still publishes (without the decliner)", async () => {
    const client = createMockClient(handlerFor({ pendingCount: 0 }));
    hoisted.adminClient = client;

    const result = await respondToCoAuthorInvitation({
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: false,
    });

    expect(result.status).toBe("declined");
    expect(result.published).toBe(true);
    const publishUpdate = client.calls.find(
      (c) => c.table === "projects" && c.op === "update",
    );
    expect(publishUpdate?.payload).toMatchObject({ status: "published" });

    const types = hoisted.createNotifications.mock.calls.flatMap((call) => {
      const input = (call as unknown[])[1];
      return (Array.isArray(input) ? input : [input]).map(
        (n) => (n as { type: string }).type,
      );
    });
    expect(types).toContain("co_author_declined");
  });

  it("declining while other invites are still pending does not publish", async () => {
    const client = createMockClient(handlerFor({ pendingCount: 1 }));
    hoisted.adminClient = client;

    const result = await respondToCoAuthorInvitation({
      contentType: "project",
      invitationId: "inv1",
      userId: "u1",
      accept: false,
    });

    expect(result.status).toBe("declined");
    expect(result.published).toBe(false);
    expect(
      client.calls.some((c) => c.table === "projects" && c.op === "update"),
    ).toBe(false);
  });
});

describe("syncCoAuthors", () => {
  it("removes dropped co-authors and invites newly added ones", async () => {
    const client = createMockClient((spec): Result => {
      if (spec.table === "project_authors" && spec.op === "select") {
        return {
          data: [
            { id: "r1", user_id: "keep" },
            { id: "r2", user_id: "drop" },
          ],
        };
      }
      if (spec.table === "profiles") {
        return {
          data: [
            { user_id: "new", username: "newbie", name: "New", avatar_url: null },
          ],
        };
      }
      if (spec.table === "project_authors" && spec.op === "insert") {
        return { data: [{ id: "r3", user_id: "new" }] };
      }
      return { error: null };
    });
    hoisted.adminClient = {}; // truthy so inviteCoAuthors attempts notifications

    await syncCoAuthors({
      supabase: client as never,
      contentType: "project",
      contentId: "c1",
      contentTitle: "Shared",
      contentSlug: "shared",
      creatorUserId: "creator",
      desiredUserIds: ["keep", "new"],
    });

    // Removed only the dropped row.
    const del = client.calls.find((c) => c.op === "delete");
    expect(del).toBeDefined();
    const inFilter = del?.filters.find((f) => f.kind === "in" && f.col === "id");
    expect(inFilter?.val).toEqual(["r2"]);

    // Inserted a pending row for the new co-author.
    const insert = client.calls.find((c) => c.op === "insert");
    expect(insert).toBeDefined();
    expect(insert?.payload).toEqual([
      expect.objectContaining({ user_id: "new", invited_by: "creator", status: "pending" }),
    ]);
  });

  it("makes no changes when the desired set equals the current set", async () => {
    const client = createMockClient((spec): Result => {
      if (spec.table === "project_authors" && spec.op === "select") {
        return { data: [{ id: "r1", user_id: "keep" }] };
      }
      return { error: null };
    });
    hoisted.adminClient = {};

    await syncCoAuthors({
      supabase: client as never,
      contentType: "project",
      contentId: "c1",
      contentTitle: "Shared",
      contentSlug: "shared",
      creatorUserId: "creator",
      desiredUserIds: ["keep"],
    });

    expect(client.calls.some((c) => c.op === "delete")).toBe(false);
    expect(client.calls.some((c) => c.op === "insert")).toBe(false);
  });
});
