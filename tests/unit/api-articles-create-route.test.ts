import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/rate-limit", () => ({
  dbRateLimit: vi.fn(async () => null),
  rateLimit: vi.fn(() => null),
}));

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/article-translations", () => ({ buildSanitizedTranslations: () => ({}) }));
vi.mock("@/lib/db/articles", () => ({
  ensureUniqueArticleSlug: vi.fn(async () => "generated-slug"),
  getArticleFeed: vi.fn(),
}));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/db/moderation-actions", () => ({
  readAutoModerationReason: vi.fn(async () => "flagged reason"),
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/db/co-authors", () => ({ inviteCoAuthors: vi.fn() }));

import { POST } from "@/app/api/articles/route";
import { NextResponse } from "next/server";
import { dbRateLimit } from "@/lib/rate-limit";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { inviteCoAuthors } from "@/lib/db/co-authors";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CO_AUTHOR = "33333333-3333-4333-8333-333333333333";
const ARTICLE_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

const base = {
  title: "A valid article title",
  excerpt: null,
  content: "This is a sufficiently long body.",
  category_slug: "general",
  status: "published" as const,
};

function viewer(user: MockUser, isAdmin: boolean, resolve: (t: string, v: string) => QueryResult) {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  holder.mock = mock;
  vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  return mock;
}

function okResolver(table: string, verb: string): QueryResult {
  if (table === "article_categories") return { data: { id: 7, admin_only: false } };
  if (table === "articles" && verb === "insert") return { data: { id: ARTICLE_ID, slug: "generated-slug" } };
  return { error: null };
}

function req(body: unknown = base): Request {
  return new Request("http://test/api/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/articles — rate limiting", () => {
  it("429 when the content-creation rate limit trips", async () => {
    viewer(authUser, false, okResolver);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "Too many" }, { status: 429 }),
    );
    expect((await POST(req())).status).toBe(429);
  });
});

describe("POST /api/articles — guards", () => {
  it("401 when unauthenticated", async () => {
    viewer(null, false, () => ({}));
    expect((await POST(req())).status).toBe(401);
  });

  it("400 on an invalid payload", async () => {
    viewer(authUser, false, okResolver);
    expect((await POST(req({ ...base, title: "" }))).status).toBe(400);
  });

  it("404 when the category is missing", async () => {
    viewer(authUser, false, (table) => (table === "article_categories" ? { data: null } : {}));
    expect((await POST(req())).status).toBe(404);
  });

  it("403 when a non-admin posts in an admin_only category", async () => {
    viewer(authUser, false, (table) =>
      table === "article_categories" ? { data: { id: 7, admin_only: true } } : {},
    );
    expect((await POST(req())).status).toBe(403);
  });
});

describe("POST /api/articles — creation", () => {
  it("inserts an approved article authored by the caller", async () => {
    const mock = viewer(authUser, false, okResolver);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "articles" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({
      author_user_id: USER_ID,
      moderation_status: "approved",
      status: "published",
    });
    expect(vi.mocked(inviteCoAuthors)).not.toHaveBeenCalled();
  });

  it("reports an article the database took down, and invites nobody", async () => {
    viewer(authUser, false, (table, verb) =>
      table === "articles" && verb === "insert"
        ? { data: { id: ARTICLE_ID, slug: "generated-slug", moderation_status: "removed" } }
        : okResolver(table, verb),
    );
    const res = await POST(req({ ...base, coAuthorUserIds: [CO_AUTHOR] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      article: { id: ARTICLE_ID, slug: "generated-slug" },
      autoRemoved: true,
      moderationReason: "flagged reason",
    });
    expect(vi.mocked(inviteCoAuthors)).not.toHaveBeenCalled();
  });

  it("holds a published article as a draft when co-authors are invited", async () => {
    const mock = viewer(authUser, false, okResolver);
    const res = await POST(req({ ...base, coAuthorUserIds: [CO_AUTHOR] }));
    expect(res.status).toBe(200);
    const insert = mock.calls.find((c) => c.table === "articles" && c.verb === "insert");
    expect((insert?.payload as { status: string }).status).toBe("draft");
    expect((insert?.payload as { publish_on_confirm: boolean }).publish_on_confirm).toBe(true);
    expect(vi.mocked(inviteCoAuthors)).toHaveBeenCalledOnce();
    expect((await res.json()).awaitingCoAuthors).toBe(true);
  });
});
