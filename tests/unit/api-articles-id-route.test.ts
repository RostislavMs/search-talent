import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

// getCurrentViewerRole bundles { user, isAdmin, supabase } — the PUT/PATCH path
// uses it; DELETE uses createClient() directly.
vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/article-translations", () => ({ buildSanitizedTranslations: () => ({}) }));
vi.mock("@/lib/db/articles", () => ({ ensureUniqueArticleSlug: vi.fn(async () => "generated") }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/auto-moderation", () => ({
  CLEAN_MODERATION_RESULT: { flagged: false, note: "" },
  collectArticleModerationText: () => "",
  screenContentForModeration: () => ({ flagged: false, note: "" }),
  describeModerationResult: () => "",
}));
vi.mock("@/lib/auto-moderation-apply", () => ({ autoRemoveContent: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/db/co-authors", () => ({ syncCoAuthors: vi.fn() }));
vi.mock("@/lib/storage/provider", () => ({ deleteStorageObject: vi.fn(async () => ({ error: null })) }));

import { PUT, DELETE } from "@/app/api/articles/[id]/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createClient } from "@/lib/supabase/server";
import { ensureUniqueArticleSlug } from "@/lib/db/articles";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "99999999-9999-4999-8999-999999999999";
const ARTICLE_ID = "22222222-2222-4222-8222-222222222222";

const validPayload = {
  title: "A perfectly valid article title",
  excerpt: null,
  content: "This is a sufficiently long article body.",
  category_slug: "general",
  status: "published" as const,
};

function params() {
  return { params: Promise.resolve({ id: ARTICLE_ID }) };
}

function putRequest(body: unknown = validPayload): Request {
  return new Request(`http://test/api/articles/${ARTICLE_ID}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Wires getCurrentViewerRole to a fresh mock client for the PUT path. */
function viewer(
  user: MockUser,
  isAdmin: boolean,
  resolve: (table: string, verb: string) => QueryResult,
) {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  holder.mock = mock;
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: user as never,
    isAdmin,
    supabase: mock.client as never,
  } as never);
  return mock;
}

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PUT /api/articles/[id] — authorization", () => {
  it("401 when unauthenticated", async () => {
    viewer(null, false, () => ({}));
    const res = await PUT(putRequest(), params());
    expect(res.status).toBe(401);
  });

  it("404 when the article does not exist", async () => {
    viewer(authUser, false, (table) => (table === "articles" ? { data: null } : {}));
    const res = await PUT(putRequest(), params());
    expect(res.status).toBe(404);
  });

  it("403 when the caller is neither author nor admin", async () => {
    viewer(authUser, false, (table) =>
      table === "articles"
        ? { data: { id: ARTICLE_ID, author_user_id: OTHER_ID, slug: "s", published_at: "2026-01-01", moderation_status: "approved", followers_notified_at: null } }
        : {},
    );
    const res = await PUT(putRequest(), params());
    expect(res.status).toBe(403);
  });

  it("403 when the category is admin_only and the caller is not admin", async () => {
    viewer(authUser, false, (table, verb) => {
      if (table === "articles" && verb === "select") {
        return { data: { id: ARTICLE_ID, author_user_id: USER_ID, slug: "s", published_at: "2026-01-01", moderation_status: "approved", followers_notified_at: null } };
      }
      if (table === "article_categories") return { data: { id: 7, admin_only: true } };
      return {};
    });
    const res = await PUT(putRequest(), params());
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/articles/[id] — happy paths", () => {
  const existingPublished = {
    id: ARTICLE_ID,
    author_user_id: USER_ID,
    slug: "stable-slug",
    published_at: "2026-01-01T00:00:00Z",
    moderation_status: "approved",
    followers_notified_at: "2026-01-01T00:00:00Z",
  };

  function resolver(table: string, verb: string): QueryResult {
    if (table === "articles" && verb === "select") return { data: existingPublished };
    if (table === "article_categories") return { data: { id: 7, admin_only: false } };
    if (table === "articles" && verb === "update") return { data: { id: ARTICLE_ID, slug: "stable-slug" } };
    return {};
  }

  it("lets the author update and keeps the published slug stable", async () => {
    const mock = viewer(authUser, false, resolver);
    const res = await PUT(putRequest(), params());
    expect(res.status).toBe(200);

    const update = mock.calls.find((c) => c.table === "articles" && c.verb === "update");
    expect((update?.payload as { slug: string }).slug).toBe("stable-slug");
    // A published article must not regenerate its slug.
    expect(vi.mocked(ensureUniqueArticleSlug)).not.toHaveBeenCalled();
  });

  it("lets an admin edit an article they do not own", async () => {
    viewer(authUser, true, (table, verb) => {
      if (table === "articles" && verb === "select") {
        return { data: { ...existingPublished, author_user_id: OTHER_ID } };
      }
      return resolver(table, verb);
    });
    const res = await PUT(putRequest(), params());
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/articles/[id] — author-only", () => {
  function wireDelete(user: MockUser, resolve: (table: string, verb: string) => QueryResult) {
    const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
    holder.mock = mock;
    vi.mocked(createClient).mockResolvedValue(mock.client as never);
    return mock;
  }

  const delParams = () => ({ params: Promise.resolve({ id: ARTICLE_ID }) });
  const delReq = () => new Request(`http://test/api/articles/${ARTICLE_ID}`, { method: "DELETE" });

  it("401 when unauthenticated", async () => {
    wireDelete(null, () => ({}));
    expect((await DELETE(delReq(), delParams())).status).toBe(401);
  });

  it("404 when the caller is not the author (admins cannot delete here)", async () => {
    wireDelete(authUser, (table) =>
      table === "articles" ? { data: { id: ARTICLE_ID, author_user_id: OTHER_ID } } : {},
    );
    expect((await DELETE(delReq(), delParams())).status).toBe(404);
  });

  it("deletes the article when the caller owns it", async () => {
    const mock = wireDelete(authUser, (table, verb) => {
      if (table === "articles" && verb === "select") {
        return { data: { id: ARTICLE_ID, author_user_id: USER_ID, cover_image_url: null, cover_image_storage_path: null, hero_video_url: null, hero_video_storage_path: null } };
      }
      return { error: null };
    });
    const res = await DELETE(delReq(), delParams());
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "articles" && c.verb === "delete")).toBe(true);
  });
});
