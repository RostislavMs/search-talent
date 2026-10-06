import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => holder.admin?.client ?? null) }));
vi.mock("@/lib/email/resend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/resend")>()),
  sendEmail: vi.fn(async () => undefined),
}));
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://site.test/" }));

import { sendEmail } from "@/lib/email/resend";
import {
  emailModerationDecisions,
  loadBlocklistedProjectIds,
  moderateContent,
  readAutoModerationReason,
  setPlatformAdmin,
  submitReport,
} from "@/lib/db/moderation-actions";

const ID = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";

function rpcClient(rpc: (fn: string, args?: unknown) => QueryResult) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const mock = createSupabaseMock({
    user: null,
    resolve: () => ({}),
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return rpc(fn, args);
    },
  });
  return { client: mock.client as never, calls };
}

function adminWith(resolve: (call: QueryCall) => QueryResult, email: string | null = "owner@example.com") {
  holder.admin = createSupabaseMock({ user: null, resolve });
  const client = holder.admin.client as unknown as { auth: Record<string, unknown> };
  client.auth.admin = {
    getUserById: vi.fn(async () => ({
      data: { user: email ? { email, user_metadata: { locale: "uk" } } : null },
    })),
  };
  return holder.admin;
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("moderateContent", () => {
  it("calls moderate_content and reads the items", async () => {
    const { client, calls } = rpcClient(() => ({
      data: {
        items: [
          { id: ID, previousStatus: "approved", status: "removed", changed: true },
          { id: "x", previousStatus: null, status: "bogus" },
          "junk",
        ],
      },
    }));
    const result = await moderateContent(client, {
      targetType: "poll",
      targetIds: [ID],
      status: "removed",
      note: "",
      reportId: null,
    });
    expect(calls).toEqual([
      {
        fn: "moderate_content",
        args: {
          p_target_type: "poll",
          p_target_ids: [ID],
          p_status: "removed",
          p_note: null,
          p_report_id: null,
          p_report_status: null,
        },
      },
    ]);
    expect(result).toEqual({
      ok: true,
      items: [{ id: ID, previousStatus: "approved", status: "removed", changed: true }],
    });
  });

  it.each([
    ["42501", 403],
    ["P0002", 404],
    ["28000", 401],
    ["22023", 400],
  ])("maps %s to %i", async (code, status) => {
    const { client } = rpcClient(() => ({ data: null, error: { code, message: "no" } }));
    expect(await moderateContent(client, { targetType: "project", targetIds: [ID], status: "approved" })).toEqual({
      ok: false,
      status,
      error: "no",
    });
  });

  it("reads an unexpected answer as no items", async () => {
    const { client } = rpcClient(() => ({ data: null }));
    expect(await moderateContent(client, { targetType: "project", targetIds: [ID], status: "approved" })).toEqual({
      ok: true,
      items: [],
    });
  });
});

describe("emailModerationDecisions", () => {
  const removed = [{ id: ID, previousStatus: "approved" as const, status: "removed" as const, changed: true }];

  it("e-mails the owner of a hidden poll in their language", async () => {
    adminWith((call) =>
      call.table === "polls"
        ? { data: { author_user_id: OWNER, title: "Best editor", slug: "best-editor" } }
        : { data: { name: "Olena", username: "olena" } },
    );
    await emailModerationDecisions({ targetType: "poll", items: removed, note: "spam" });
    expect(sendEmail).toHaveBeenCalledOnce();
    const message = vi.mocked(sendEmail).mock.calls[0][0] as { to: string; html: string; text: string };
    expect(message.to).toBe("owner@example.com");
    expect(message.text).toContain("https://site.test/uk/polls/best-editor");
    expect(message.text).toContain("Опитування");
    expect(message.text).toContain("spam");
  });

  it("links profiles, projects and articles to their pages", async () => {
    adminWith((call) =>
      call.table === "profiles"
        ? { data: { user_id: OWNER, name: "", username: "olena" } }
        : call.table === "projects"
          ? { data: { owner_id: OWNER, title: "Night city", slug: null } }
          : { data: { author_user_id: OWNER, title: "Tips", slug: "tips" } },
    );
    await emailModerationDecisions({ targetType: "profile", items: removed, note: null });
    await emailModerationDecisions({ targetType: "project", items: removed, note: null });
    await emailModerationDecisions({ targetType: "article", items: removed, note: null });
    const texts = vi.mocked(sendEmail).mock.calls.map((call) => (call[0] as { text: string }).text);
    expect(texts[0]).toContain("/uk/u/olena");
    expect(texts[1]).toContain(`/uk/projects/${ID}`);
    expect(texts[2]).toContain("/uk/articles/tips");
  });

  it("writes only about hidden content that changed", async () => {
    adminWith(() => ({ data: { owner_id: OWNER, title: "T" } }));
    await emailModerationDecisions({
      targetType: "project",
      items: [
        { id: ID, previousStatus: "removed", status: "removed", changed: false },
        { id: ID, previousStatus: "removed", status: "approved", changed: true },
      ],
      note: null,
    });
    await emailModerationDecisions({ targetType: "company", items: removed, note: null });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("stays quiet without the key, an owner or an address, and never throws", async () => {
    await emailModerationDecisions({ targetType: "project", items: removed, note: null });
    adminWith(() => ({ data: null }));
    await emailModerationDecisions({ targetType: "project", items: removed, note: null });
    adminWith(() => ({ data: { owner_id: OWNER, title: "T" } }), null);
    await emailModerationDecisions({ targetType: "project", items: removed, note: null });
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("down"));
    adminWith(() => ({ data: { owner_id: OWNER, title: "T" } }));
    await expect(
      emailModerationDecisions({ targetType: "project", items: removed, note: null }),
    ).resolves.toBeUndefined();
  });
});

describe("readAutoModerationReason", () => {
  it("explains what the database found", async () => {
    const { client, calls } = rpcClient(() => ({
      data: { flagged: true, categories: ["spam"], matches: [{ category: "spam", detail: "links", count: 15 }] },
    }));
    expect(await readAutoModerationReason(client, "article", ID, "en")).toContain("too many links: 15");
    expect(calls[0]).toEqual({ fn: "content_auto_moderation", args: { p_target_type: "article", p_target_id: ID } });
  });

  it("falls back to the generic sentence", async () => {
    const { client } = rpcClient(() => ({ data: null }));
    expect(await readAutoModerationReason(client, "project", ID, "uk")).toBe(
      "Контент не пройшов автоматичну перевірку. Відредагуйте текст і спробуйте ще раз.",
    );
  });
});

describe("loadBlocklistedProjectIds", () => {
  it("asks once for the whole batch", async () => {
    const { client, calls } = rpcClient(() => ({ data: [ID, { blocklisted_project_ids: "b" }] }));
    expect(await loadBlocklistedProjectIds(client, [ID, "b", "c"])).toEqual(new Set([ID, "b"]));
    expect(calls).toEqual([{ fn: "blocklisted_project_ids", args: { p_ids: [ID, "b", "c"] } }]);
  });

  it("skips the call for nothing and leaves nothing out on an error", async () => {
    const { client, calls } = rpcClient(() => ({ data: null, error: { message: "down" } }));
    expect(await loadBlocklistedProjectIds(client, [])).toEqual(new Set());
    expect(calls).toHaveLength(0);
    expect(await loadBlocklistedProjectIds(client, [ID])).toEqual(new Set());
  });
});

describe("submitReport", () => {
  it("files the report", async () => {
    const { client, calls } = rpcClient(() => ({ data: { id: "r1" } }));
    expect(await submitReport(client, { targetType: "poll_comment", targetId: ID, reason: "other" })).toEqual({
      ok: true,
      id: "r1",
    });
    expect(calls[0]).toEqual({
      fn: "submit_report",
      args: { p_target_type: "poll_comment", p_target_id: ID, p_reason: "other", p_details: null },
    });
  });
});

describe("setPlatformAdmin", () => {
  it("says whether anything changed", async () => {
    const { client } = rpcClient(() => ({ data: { changed: false } }));
    expect(await setPlatformAdmin(client, ID, true)).toEqual({ ok: true, changed: false });
  });

  it("falls back to its own message", async () => {
    const { client } = rpcClient(() => ({ data: null, error: { code: "XX000" } }));
    expect(await setPlatformAdmin(client, ID, true)).toEqual({ ok: false, status: 400, error: "Could not grant admin role" });
    expect(await setPlatformAdmin(client, ID, false)).toEqual({ ok: false, status: 400, error: "Could not revoke admin role" });
  });
});
