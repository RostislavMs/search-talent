import { afterEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data?: unknown; error?: { message: string } | null };

const { holder } = vi.hoisted(() => ({
  holder: { admin: null as Record<string, unknown> | null },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => holder.admin) }));
vi.mock("@/lib/storage/r2", () => ({
  deleteFromR2: vi.fn(async () => undefined),
  getR2KeyFromUrl: vi.fn((url: string) =>
    url.startsWith("https://pub.r2.dev/") ? url.slice("https://pub.r2.dev/".length) : null,
  ),
}));

import {
  deleteAccount,
  eraseTrashGroup,
  listTrashItems,
  restoreTrashGroup,
  runTrashCleanup,
  setSignInBlocked,
} from "@/lib/db/trash";
import { deleteFromR2 } from "@/lib/storage/r2";

const USER = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";

/** A client whose rpc answers per function name. */
function client(answers: Record<string, RpcResult | ((args: unknown) => RpcResult)>) {
  const rpc = vi.fn(async (fn: string, args?: unknown) => {
    const answer = answers[fn];
    const result = typeof answer === "function" ? answer(args) : answer;
    return { data: result?.data ?? null, error: result?.error ?? null };
  });
  return { rpc };
}

function adminClient(
  answers: Record<string, RpcResult | ((args: unknown) => RpcResult)> = {},
  auth: { updateError?: string; deleteError?: string } = {},
) {
  const updateUserById = vi.fn(async () => ({ error: auth.updateError ? { message: auth.updateError } : null }));
  const deleteUser = vi.fn(async () => ({ error: auth.deleteError ? { message: auth.deleteError } : null }));
  const remove = vi.fn(async () => ({ error: null }));
  const admin = {
    ...client(answers),
    auth: { admin: { updateUserById, deleteUser } },
    storage: { from: vi.fn(() => ({ remove })) },
  };
  return { admin, updateUserById, deleteUser, remove };
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("listTrashItems", () => {
  it("maps the admin list", async () => {
    const supabase = client({
      admin_trash_list: {
        data: [
          {
            group_id: GROUP,
            table_name: "projects",
            kind: "project",
            summary: "Landing page",
            owner_user_id: USER,
            owner_username: "alice",
            deleted_by_username: null,
            reason: "user",
            deleted_at: "2026-10-05T10:00:00Z",
            purge_after: "2026-12-04T10:00:00Z",
            related_count: null,
            account_email: null,
          },
        ],
      },
    });
    const items = await listTrashItems(supabase as never, { kind: "project", offset: 50, limit: 100 });
    expect(supabase.rpc).toHaveBeenCalledWith("admin_trash_list", { p_kind: "project", p_limit: 100, p_offset: 50 });
    expect(items).toEqual([
      expect.objectContaining({ groupId: GROUP, kind: "project", summary: "Landing page", ownerUsername: "alice", relatedCount: 0 }),
    ]);
  });

  it("defaults to everything, first page, and returns null when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = client({ admin_trash_list: { error: { message: "function does not exist" } } });
    expect(await listTrashItems(supabase as never)).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("admin_trash_list", { p_kind: null, p_limit: 50, p_offset: 0 });
  });
});

describe("restoreTrashGroup", () => {
  it("restores an item", async () => {
    const supabase = client({ admin_trash_restore: { data: { restored: 8, account_user_id: null } } });
    expect(await restoreTrashGroup(supabase as never, GROUP)).toEqual({ ok: true, restored: 8, accountUserId: null });
  });

  it("gives a restored account its sign-in back", async () => {
    const { admin, updateUserById } = adminClient();
    holder.admin = admin;
    const supabase = client({ admin_trash_restore: { data: { restored: 30, account_user_id: USER } } });
    expect(await restoreTrashGroup(supabase as never, GROUP)).toEqual({ ok: true, restored: 30, accountUserId: USER });
    expect(updateUserById).toHaveBeenCalledWith(USER, { ban_duration: "none" });
  });

  it("explains why a restore failed", async () => {
    const supabase = client({ admin_trash_restore: { error: { message: "restore_conflict:projects" } } });
    expect(await restoreTrashGroup(supabase as never, GROUP)).toEqual({ ok: false, code: "conflict", table: "projects" });
  });
});

describe("eraseTrashGroup", () => {
  it("erases an item", async () => {
    const supabase = client({ admin_trash_purge: { data: { erased: true, account_user_id: null } } });
    expect(await eraseTrashGroup(supabase as never, GROUP)).toEqual({ ok: true, accountUserId: null });
  });

  it("deletes an account's auth user, then its trash group", async () => {
    const { admin, deleteUser } = adminClient({ finish_account_deletion: {} });
    holder.admin = admin;
    const supabase = client({ admin_trash_purge: { data: { erased: false, account_user_id: USER } } });
    expect(await eraseTrashGroup(supabase as never, GROUP)).toEqual({ ok: true, accountUserId: USER });
    expect(deleteUser).toHaveBeenCalledWith(USER);
    expect(admin.rpc).toHaveBeenCalledWith("finish_account_deletion", { p_user_id: USER });
  });

  it("leaves an account to the cron when the auth user cannot be deleted now", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = adminClient({}, { deleteError: "network" });
    holder.admin = admin;
    const supabase = client({ admin_trash_purge: { data: { account_user_id: USER } } });
    expect(await eraseTrashGroup(supabase as never, GROUP)).toEqual({ ok: false, code: "failed", table: null });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("fails without the service key, and maps database errors", async () => {
    const accountPurge = client({ admin_trash_purge: { data: { account_user_id: USER } } });
    expect((await eraseTrashGroup(accountPurge as never, GROUP)).ok).toBe(false);
    const missing = client({ admin_trash_purge: { error: { message: "trash_group_not_found" } } });
    expect(await eraseTrashGroup(missing as never, GROUP)).toEqual({ ok: false, code: "not_found", table: null });
  });
});

describe("deleteAccount", () => {
  it("moves the account into the trash and blocks sign-in for 61 days", async () => {
    const { admin, updateUserById } = adminClient();
    holder.admin = admin;
    const supabase = client({ delete_account: { data: GROUP } });
    expect(await deleteAccount(supabase as never, USER, "anonymize")).toEqual({ ok: true, groupId: GROUP });
    expect(supabase.rpc).toHaveBeenCalledWith("delete_account", { p_user_id: USER, p_mode: "anonymize" });
    expect(updateUserById).toHaveBeenCalledWith(USER, { ban_duration: "1464h" });
  });

  it.each([
    ["already_deleted", "already_deleted"],
    ["forbidden", "forbidden"],
    ["user_not_found", "not_found"],
    ["deadlock detected", "failed"],
  ])("maps %s", async (message, code) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = client({ delete_account: { error: { message } } });
    expect(await deleteAccount(supabase as never, USER, "erase")).toEqual({ ok: false, code });
  });
});

describe("setSignInBlocked", () => {
  it("needs the service key and reports Auth errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await setSignInBlocked(USER, true)).toBe(false);
    const { admin } = adminClient({}, { updateError: "user not found" });
    holder.admin = admin;
    expect(await setSignInBlocked(USER, true)).toBe(false);
  });
});

describe("runTrashCleanup", () => {
  it("does nothing without the service key", async () => {
    expect(await runTrashCleanup()).toEqual({ skipped: true });
  });

  it("finishes due accounts, erases expired groups and deletes their files", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin, deleteUser, remove } = adminClient({
      trash_due_accounts: { data: [USER, "33333333-3333-4333-8333-333333333333"] },
      finish_account_deletion: {},
      trash_purge_due: { data: 4 },
      storage_cleanup_next: {
        data: [
          { id: 1, ref: "https://pub.r2.dev/p1/a.png" },
          { id: 2, ref: "p1/a.png" },
          { id: 3, ref: "https://abc.supabase.co/storage/v1/object/public/project-media/p1/old.png" },
          { id: 4, ref: "https://media.giphy.com/x.gif" },
          { id: 5, ref: "p1/broken.png" },
        ],
      },
      storage_cleanup_finish: {},
    });
    // The second account is already gone from Auth: that still counts.
    deleteUser.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "User not found" } });
    vi.mocked(deleteFromR2).mockImplementation(async (key: string) => {
      if (key === "p1/broken.png") throw new Error("R2 down");
    });
    holder.admin = admin;

    expect(await runTrashCleanup()).toEqual({ accounts: 2, groups: 4, files: 4, fileFailures: 1 });
    expect(deleteFromR2).toHaveBeenCalledWith("p1/a.png");
    expect(remove).toHaveBeenCalledWith(["p1/old.png"]);
    expect(admin.rpc).toHaveBeenCalledWith("storage_cleanup_finish", { p_done: [1, 2, 3, 4], p_failed: [5] });
  });

  it("keeps an account for the next run when Auth refuses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = adminClient(
      { trash_due_accounts: { data: [USER] }, trash_purge_due: { data: 0 }, storage_cleanup_next: { data: [] } },
      { deleteError: "network" },
    );
    holder.admin = admin;
    expect(await runTrashCleanup()).toEqual({ accounts: 0, groups: 0, files: 0, fileFailures: 0 });
    expect(admin.rpc).not.toHaveBeenCalledWith("finish_account_deletion", expect.anything());
    expect(admin.rpc).not.toHaveBeenCalledWith("storage_cleanup_finish", expect.anything());
  });

  it.each(["trash_due_accounts", "trash_purge_due", "storage_cleanup_next", "storage_cleanup_finish"])(
    "stops when %s fails",
    async (failing) => {
      const answers: Record<string, RpcResult> = {
        trash_due_accounts: { data: [] },
        trash_purge_due: { data: 0 },
        storage_cleanup_next: { data: [{ id: 1, ref: "p1/a.png" }] },
        storage_cleanup_finish: {},
      };
      answers[failing] = { error: { message: "boom" } };
      holder.admin = adminClient(answers).admin;
      await expect(runTrashCleanup()).rejects.toThrow(`${failing}: boom`);
    },
  );
});
