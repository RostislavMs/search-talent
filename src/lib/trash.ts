/**
 * The trash (part 9): deleted rows wait 60 days in the database before they
 * are erased for good. The database does the work — capture, restore, purge —
 * these helpers only describe and route its results.
 */

/** How long a deleted item is kept, in days (mirrors the SQL default). */
export const TRASH_RETENTION_DAYS = 60;

/**
 * Sign-in stays blocked a day past the retention, so the cron always deletes
 * the auth user before the block could lapse.
 */
export const DELETED_ACCOUNT_BAN = `${(TRASH_RETENTION_DAYS + 1) * 24}h`;

export const TRASH_KINDS = [
  "account",
  "project",
  "article",
  "poll",
  "comment",
  "company",
  "vacancy",
  "other",
] as const;

export type TrashKind = (typeof TRASH_KINDS)[number];

export function isTrashKind(value: unknown): value is TrashKind {
  return typeof value === "string" && (TRASH_KINDS as readonly string[]).includes(value);
}

export type TrashReason = "user" | "admin" | "account" | "system";

export type TrashItem = {
  groupId: string;
  tableName: string;
  kind: TrashKind;
  summary: string | null;
  ownerUserId: string | null;
  ownerUsername: string | null;
  deletedByUsername: string | null;
  reason: TrashReason;
  deletedAt: string;
  purgeAfter: string;
  relatedCount: number;
  accountEmail: string | null;
};

export type TrashRestoreFailure = "conflict" | "missing_parent" | "not_found" | "forbidden" | "failed";

/** Maps a database error from restore/erase to something a person can act on. */
export function classifyTrashError(message: string | null | undefined): {
  code: TrashRestoreFailure;
  table: string | null;
} {
  const text = message ?? "";
  const conflict = /restore_conflict:([a-z_]+)/.exec(text);
  if (conflict) return { code: "conflict", table: conflict[1] };
  const missing = /restore_missing_parent:([a-z_]+)/.exec(text);
  if (missing) return { code: "missing_parent", table: missing[1] };
  if (text.includes("trash_group_not_found") || text.includes("account_not_deleted")) {
    return { code: "not_found", table: null };
  }
  if (text.includes("forbidden")) return { code: "forbidden", table: null };
  return { code: "failed", table: null };
}

export type StorageTarget =
  | { provider: "r2"; key: string }
  | { provider: "supabase"; bucket: string; path: string };

const SUPABASE_PUBLIC_PATH = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/**
 * Where a queued file reference lives. The database only queues references
 * inside the owner's, project's or company's own folders; this decides the
 * backend. Anything unrecognised is skipped (and leaves the queue).
 */
export function resolveStorageRef(
  ref: string,
  r2KeyFromUrl: (url: string) => string | null,
): StorageTarget | null {
  const value = ref.trim();
  if (!value || value.split("/").includes("..")) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    const r2Key = r2KeyFromUrl(value);
    if (r2Key) {
      return { provider: "r2", key: r2Key };
    }

    try {
      const match = SUPABASE_PUBLIC_PATH.exec(new URL(value).pathname);
      if (match) {
        return {
          provider: "supabase",
          bucket: decodeURIComponent(match[1]),
          path: match[2].split("/").map((segment) => decodeURIComponent(segment)).join("/"),
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  // A bare key: new uploads all live in R2.
  if (value.startsWith("/")) {
    return null;
  }
  return { provider: "r2", key: value };
}
