import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  generateUniqueProjectSlug: vi.fn(async () => "unique-slug"),
}));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/db/github-integrations", () => ({ getIntegrationForUser: vi.fn(async () => null) }));
vi.mock("@/lib/integrations/github", () => ({ fetchRepoFullDetail: vi.fn(async () => null) }));
vi.mock("@/lib/db/github-sync", () => ({ mapRepoToProjectColumns: vi.fn(() => ({})) }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/auto-moderation", () => ({
  CLEAN_MODERATION_RESULT: { flagged: false, note: "" },
  collectProjectModerationText: () => "",
  screenContentForModeration: vi.fn(() => ({ flagged: false, note: "" })),
  describeModerationResult: () => "flagged reason",
}));
vi.mock("@/lib/auto-moderation-apply", () => ({ autoRemoveContent: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/db/co-authors", () => ({ inviteCoAuthors: vi.fn() }));

import { POST } from "@/app/api/projects/route";
import { screenContentForModeration } from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { inviteCoAuthors } from "@/lib/db/co-authors";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CO_AUTHOR = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const base = { title: "My New Project" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

function okResolver(table: string, verb: string): QueryResult {
  if (table === "projects" && verb === "insert") {
    return { data: { id: PROJECT_ID, slug: "unique-slug", status: "published" } };
  }
  return { error: null };
}

function req(body: unknown = base): Request {
  return new Request("http://test/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
  vi.mocked(screenContentForModeration).mockReturnValue({ flagged: false, note: "" } as never);
});

describe("POST /api/projects", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req())).status).toBe(401);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, okResolver);
    expect((await POST(req({ title: "" }))).status).toBe(400);
  });

  it("inserts a project owned by the caller", async () => {
    const mock = setMock(authUser, okResolver);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "projects" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({ owner_id: USER_ID, slug: "unique-slug" });
    expect(vi.mocked(inviteCoAuthors)).not.toHaveBeenCalled();
  });

  it("auto-removes flagged content", async () => {
    vi.mocked(screenContentForModeration).mockReturnValue({ flagged: true, note: "bad" } as never);
    setMock(authUser, okResolver);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(vi.mocked(autoRemoveContent)).toHaveBeenCalledWith({ table: "projects", id: PROJECT_ID, note: "bad" });
    expect((await res.json()).autoRemoved).toBe(true);
  });

  it("holds as a draft and invites co-authors when provided", async () => {
    const mock = setMock(authUser, (table, verb) =>
      table === "projects" && verb === "insert"
        ? { data: { id: PROJECT_ID, slug: "unique-slug", status: "draft" } }
        : okResolver(table, verb),
    );
    const res = await POST(req({ ...base, coAuthorUserIds: [CO_AUTHOR] }));
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "projects" && c.verb === "insert");
    expect((insert?.payload as { status: string }).status).toBe("draft");
    expect(vi.mocked(inviteCoAuthors)).toHaveBeenCalledOnce();
    expect((await res.json()).awaitingCoAuthors).toBe(true);
  });

  it("maps an insert error to 400", async () => {
    setMock(authUser, (table, verb) =>
      table === "projects" && verb === "insert" ? { error: { message: "insert boom" } } : {},
    );
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("insert boom");
  });
});
