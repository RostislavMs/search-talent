import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DELETED_ACCOUNT_BAN,
  TRASH_KINDS,
  TRASH_RETENTION_DAYS,
  classifyTrashError,
  isTrashKind,
  resolveStorageRef,
} from "@/lib/trash";

vi.mock("server-only", () => ({}));

describe("trash constants", () => {
  it("keeps deleted data 60 days and blocks sign-in a day longer", () => {
    expect(TRASH_RETENTION_DAYS).toBe(60);
    // Supabase Auth takes a Go duration; the cron must win the race.
    expect(DELETED_ACCOUNT_BAN).toBe("1464h");
  });

  it("recognises only the kinds the database returns", () => {
    for (const kind of TRASH_KINDS) expect(isTrashKind(kind)).toBe(true);
    expect(isTrashKind("profiles")).toBe(false);
    expect(isTrashKind(undefined)).toBe(false);
    expect(isTrashKind(3)).toBe(false);
  });
});

describe("classifyTrashError", () => {
  it("names the table a restore collided on", () => {
    expect(classifyTrashError('restore_conflict:projects (SQLSTATE 23505)')).toEqual({ code: "conflict", table: "projects" });
  });

  it("names the table whose parent is gone", () => {
    expect(classifyTrashError("restore_missing_parent:project_comments")).toEqual({
      code: "missing_parent",
      table: "project_comments",
    });
  });

  it("maps a missing group or account, a refusal, and anything else", () => {
    expect(classifyTrashError("trash_group_not_found").code).toBe("not_found");
    expect(classifyTrashError("account_not_deleted").code).toBe("not_found");
    expect(classifyTrashError("forbidden").code).toBe("forbidden");
    expect(classifyTrashError("connection reset")).toEqual({ code: "failed", table: null });
    expect(classifyTrashError(null)).toEqual({ code: "failed", table: null });
  });
});

describe("resolveStorageRef", () => {
  const r2Key = (url: string) => (url.startsWith("https://pub.r2.dev/") ? url.slice("https://pub.r2.dev/".length) : null);

  it("turns one of our R2 urls into its key", () => {
    expect(resolveStorageRef("https://pub.r2.dev/articles/u1/cover.png", r2Key)).toEqual({
      provider: "r2",
      key: "articles/u1/cover.png",
    });
  });

  it("finds the bucket and path of a legacy Supabase Storage url", () => {
    expect(
      resolveStorageRef("https://abc.supabase.co/storage/v1/object/public/project-media/p1/a%20b.png", r2Key),
    ).toEqual({ provider: "supabase", bucket: "project-media", path: "p1/a b.png" });
  });

  it("treats a bare key as an R2 key", () => {
    expect(resolveStorageRef("p1/1-shot.png", r2Key)).toEqual({ provider: "r2", key: "p1/1-shot.png" });
  });

  it("skips anything else", () => {
    expect(resolveStorageRef("https://media.giphy.com/media/x/giphy.gif", r2Key)).toBeNull();
    expect(resolveStorageRef("/absolute/path", r2Key)).toBeNull();
    expect(resolveStorageRef("p1/../avatars/u2/avatar", r2Key)).toBeNull();
    expect(resolveStorageRef("   ", r2Key)).toBeNull();
    expect(resolveStorageRef("https://%zz", r2Key)).toBeNull();
  });
});

describe("getR2KeyFromUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(base: string) {
    vi.stubEnv("R2_PUBLIC_BASE_URL", base);
    vi.resetModules();
    return import("@/lib/storage/r2");
  }

  it("strips the public base and decodes each segment", async () => {
    const { getR2KeyFromUrl } = await load("https://media.searchtalent.example");
    expect(getR2KeyFromUrl("https://media.searchtalent.example/avatars/u1/avatar?v=3")).toBe("avatars/u1/avatar");
    expect(getR2KeyFromUrl("https://media.searchtalent.example/p1/a%20b.png")).toBe("p1/a b.png");
  });

  it("strips a base with a path prefix", async () => {
    const { getR2KeyFromUrl } = await load("https://pub.r2.dev/bucket/");
    expect(getR2KeyFromUrl("https://pub.r2.dev/bucket/feedback/u1/x.png")).toBe("feedback/u1/x.png");
  });

  it("returns null for other hosts, the bare host and broken encodings", async () => {
    const { getR2KeyFromUrl } = await load("https://media.searchtalent.example");
    expect(getR2KeyFromUrl("https://evil.example/avatars/u1/avatar")).toBeNull();
    expect(getR2KeyFromUrl("https://media.searchtalent.example/")).toBeNull();
    expect(getR2KeyFromUrl("https://media.searchtalent.example/%E0%A4%A")).toBeNull();
  });
});
