import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFromR2, getR2KeyFromUrl } from "@/lib/storage/r2";
import {
  DELETED_ACCOUNT_BAN,
  classifyTrashError,
  resolveStorageRef,
  type TrashItem,
  type TrashKind,
  type TrashReason,
  type TrashRestoreFailure,
} from "@/lib/trash";

type ServiceClient = NonNullable<ReturnType<typeof createAdminClient>>;

type TrashRow = {
  group_id: string;
  table_name: string;
  kind: TrashKind;
  summary: string | null;
  owner_user_id: string | null;
  owner_username: string | null;
  deleted_by_username: string | null;
  reason: TrashReason;
  deleted_at: string;
  purge_after: string;
  related_count: number | null;
  account_email: string | null;
};

export const TRASH_PAGE_SIZE = 50;

/** One page of the admin trash list (roots only, newest first). */
export async function listTrashItems(
  supabase: SupabaseClient,
  options: { kind?: TrashKind | null; offset?: number; limit?: number } = {},
): Promise<TrashItem[] | null> {
  // The database caps one page at 200 rows.
  const { data, error } = await supabase.rpc("admin_trash_list", {
    p_kind: options.kind ?? null,
    p_limit: options.limit ?? TRASH_PAGE_SIZE,
    p_offset: Math.max(0, options.offset ?? 0),
  });

  if (error) {
    console.error("[trash] list failed", error.message);
    return null;
  }

  return ((data ?? []) as TrashRow[]).map((row) => ({
    groupId: row.group_id,
    tableName: row.table_name,
    kind: row.kind,
    summary: row.summary,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    deletedByUsername: row.deleted_by_username,
    reason: row.reason,
    deletedAt: row.deleted_at,
    purgeAfter: row.purge_after,
    relatedCount: row.related_count ?? 0,
    accountEmail: row.account_email,
  }));
}

export type TrashActionResult =
  | { ok: true; restored?: number; accountUserId: string | null }
  | { ok: false; code: TrashRestoreFailure; table: string | null };

/**
 * Puts a deleted group back (admin session; the function checks the role).
 * A restored account gets its sign-in back.
 */
export async function restoreTrashGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<TrashActionResult> {
  const { data, error } = await supabase.rpc("admin_trash_restore", { p_group: groupId });

  if (error) {
    return { ok: false, ...classifyTrashError(error.message) };
  }

  const result = (data ?? {}) as { restored?: number; account_user_id?: string | null };
  const accountUserId = result.account_user_id ?? null;

  if (accountUserId) {
    await setSignInBlocked(accountUserId, false);
  }

  return { ok: true, restored: result.restored ?? 0, accountUserId };
}

/**
 * "Erase now". For a deleted account this deletes the auth user right away
 * and then erases its group; anything else is erased by the database.
 */
export async function eraseTrashGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<TrashActionResult> {
  const { data, error } = await supabase.rpc("admin_trash_purge", { p_group: groupId });

  if (error) {
    return { ok: false, ...classifyTrashError(error.message) };
  }

  const result = (data ?? {}) as { account_user_id?: string | null };
  const accountUserId = result.account_user_id ?? null;

  if (accountUserId) {
    const finished = await finishAccountDeletion(accountUserId);
    if (!finished) {
      // Marked due in the database; the next cron run finishes it.
      return { ok: false, code: "failed", table: null };
    }
  }

  return { ok: true, accountUserId };
}

export type DeleteAccountResult =
  | { ok: true; groupId: string }
  | { ok: false; code: "already_deleted" | "forbidden" | "not_found" | "failed" };

/**
 * Deletes an account the way the trash expects: the database moves
 * everything the person owns into one group, then sign-in is blocked until
 * the cron deletes the auth user 60 days later.
 *
 * `client` is the service client for a person deleting their own account
 * (after the emailed code), or the admin's session for an admin removal.
 */
export async function deleteAccount(
  client: SupabaseClient,
  userId: string,
  mode: "erase" | "anonymize",
): Promise<DeleteAccountResult> {
  const { data, error } = await client.rpc("delete_account", {
    p_user_id: userId,
    p_mode: mode,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("already_deleted")) return { ok: false, code: "already_deleted" };
    if (message.includes("forbidden")) return { ok: false, code: "forbidden" };
    if (message.includes("user_not_found")) return { ok: false, code: "not_found" };
    console.error("[trash] delete_account failed", message);
    return { ok: false, code: "failed" };
  }

  await setSignInBlocked(userId, true);
  return { ok: true, groupId: String(data) };
}

/** Blocks (or lifts the block on) signing in, through the Auth admin API. */
export async function setSignInBlocked(userId: string, blocked: boolean): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("[trash] sign-in block skipped: no service key");
    return false;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? DELETED_ACCOUNT_BAN : "none",
  });

  if (error) {
    console.error("[trash] sign-in block failed", error.message);
    return false;
  }
  return true;
}

/** The final step for an account: delete the auth user, then erase its group. */
async function finishAccountDeletion(userId: string, admin?: ServiceClient | null): Promise<boolean> {
  const client = admin ?? createAdminClient();
  if (!client) {
    return false;
  }

  const { error: authError } = await client.auth.admin.deleteUser(userId);
  if (authError && !/not.?found/i.test(authError.message ?? "")) {
    console.error("[trash] auth user delete failed", authError.message);
    return false;
  }

  const { error } = await client.rpc("finish_account_deletion", { p_user_id: userId });
  if (error) {
    console.error("[trash] finish_account_deletion failed", error.message);
    return false;
  }
  return true;
}

export type TrashCleanupResult = {
  accounts: number;
  groups: number;
  files: number;
  fileFailures: number;
};

const FILE_BATCH = 200;

/**
 * The daily part of the trash (runs in the expire-vacancies cron): accounts
 * whose 60 days are over are deleted for good, other expired groups are
 * erased, and the files they referenced are removed from storage.
 */
export async function runTrashCleanup(): Promise<TrashCleanupResult | { skipped: true }> {
  const admin = createAdminClient();
  if (!admin) {
    return { skipped: true };
  }

  let accounts = 0;
  const { data: dueAccounts, error: dueError } = await admin.rpc("trash_due_accounts");
  if (dueError) {
    throw new Error(`trash_due_accounts: ${dueError.message}`);
  }
  for (const userId of (dueAccounts ?? []) as string[]) {
    if (await finishAccountDeletion(userId, admin)) {
      accounts += 1;
    }
  }

  const { data: purged, error: purgeError } = await admin.rpc("trash_purge_due");
  if (purgeError) {
    throw new Error(`trash_purge_due: ${purgeError.message}`);
  }

  const { data: queue, error: queueError } = await admin.rpc("storage_cleanup_next", {
    p_limit: FILE_BATCH,
  });
  if (queueError) {
    throw new Error(`storage_cleanup_next: ${queueError.message}`);
  }

  const done: number[] = [];
  const failed: number[] = [];
  for (const item of (queue ?? []) as Array<{ id: number; ref: string }>) {
    const target = resolveStorageRef(item.ref, getR2KeyFromUrl);
    try {
      if (target?.provider === "r2") {
        await deleteFromR2(target.key);
      } else if (target?.provider === "supabase") {
        const { error } = await admin.storage.from(target.bucket).remove([target.path]);
        if (error) throw new Error(error.message);
      }
      done.push(item.id);
    } catch (error) {
      console.error("[trash] file delete failed", item.ref, error);
      failed.push(item.id);
    }
  }

  if (done.length > 0 || failed.length > 0) {
    const { error } = await admin.rpc("storage_cleanup_finish", {
      p_done: done,
      p_failed: failed,
    });
    if (error) {
      throw new Error(`storage_cleanup_finish: ${error.message}`);
    }
  }

  return {
    accounts,
    groups: Number(purged ?? 0),
    files: done.length,
    fileFailures: failed.length,
  };
}
