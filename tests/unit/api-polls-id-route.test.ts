import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/poll-translations", () => ({ buildSanitizedPollTranslations: () => ({}) }));
vi.mock("@/lib/db/polls", () => ({ ensureUniquePollSlug: vi.fn(async () => "generated") }));
vi.mock("@/lib/storage/provider", () => ({ deleteStorageObject: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/db/co-authors", () => ({ syncCoAuthors: vi.fn() }));
vi.mock("@/lib/auto-moderation", () => ({
  CLEAN_MODERATION_RESULT: { flagged: false, note: "" },
  collectPollModerationText: () => "",
  screenContentForModeration: () => ({ flagged: false, note: "" }),
  describeModerationResult: () => "",
}));
vi.mock("@/lib/auto-moderation-apply", () => ({ autoRemoveContent: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));

import { PUT, DELETE } from "@/app/api/polls/[id]/route";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createClient } from "@/lib/supabase/server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "99999999-9999-4999-8999-999999999999";
const POLL_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

const validPayload = {
  title: "A valid poll title",
  category_slug: "general",
  questions: [
    { question_type: "single", prompt: "Pick one", options: [{ label: "A" }, { label: "B" }] },
  ],
};

const existingPoll = {
  id: POLL_ID,
  author_user_id: USER_ID,
  slug: "stable-slug",
  moderation_status: "approved",
  followers_notified_at: "2026-01-01T00:00:00Z",
  published_at: "2026-01-01T00:00:00Z",
};

function viewer(
  user: MockUser,
  isAdmin: boolean,
  resolve: (table: string, verb: string) => QueryResult,
  rpc?: () => QueryResult,
) {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb), rpc });
  holder.mock = mock;
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: user as never,
    isAdmin,
    supabase: mock.client as never,
  } as never);
  return mock;
}

const params = () => ({ params: Promise.resolve({ id: POLL_ID }) });
function putReq(body: unknown = validPayload): Request {
  return new Request(`http://test/api/polls/${POLL_ID}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PUT /api/polls/[id] — authorization", () => {
  it("401 when unauthenticated", async () => {
    viewer(null, false, () => ({}));
    expect((await PUT(putReq(), params())).status).toBe(401);
  });

  it("404 when the poll does not exist", async () => {
    viewer(authUser, false, (table) => (table === "polls" ? { data: null } : {}));
    expect((await PUT(putReq(), params())).status).toBe(404);
  });

  it("403 when neither author nor admin", async () => {
    viewer(authUser, false, (table) =>
      table === "polls" ? { data: { ...existingPoll, author_user_id: OTHER_ID } } : {},
    );
    expect((await PUT(putReq(), params())).status).toBe(403);
  });

  it("403 when the category is admin_only and caller is not admin", async () => {
    viewer(authUser, false, (table, verb) => {
      if (table === "polls" && verb === "select") return { data: existingPoll };
      if (table === "poll_categories") return { data: { id: 7, admin_only: true } };
      return {};
    });
    expect((await PUT(putReq(), params())).status).toBe(403);
  });
});

describe("PUT /api/polls/[id] — happy paths", () => {
  function baseResolve(table: string, verb: string): QueryResult {
    if (table === "polls" && verb === "select") return { data: existingPoll };
    if (table === "poll_categories") return { data: { id: 7, admin_only: false } };
    if (table === "polls" && verb === "update") return { error: null };
    return {};
  }

  it("saves via the save_poll RPC for the author", async () => {
    const rpc = vi.fn(() => ({ data: { id: POLL_ID, slug: "stable-slug" } }));
    viewer(authUser, false, baseResolve, rpc);
    const res = await PUT(putReq(), params());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalled();
    expect((await res.json()).poll).toMatchObject({ id: POLL_ID, slug: "stable-slug" });
  });

  it("400 when the RPC returns an error", async () => {
    viewer(authUser, false, baseResolve, () => ({ error: { message: "rpc boom" } }));
    const res = await PUT(putReq(), params());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("rpc boom");
  });

  it("lets an admin edit a poll they do not own", async () => {
    viewer(
      authUser,
      true,
      (table, verb) => {
        if (table === "polls" && verb === "select") return { data: { ...existingPoll, author_user_id: OTHER_ID } };
        return baseResolve(table, verb);
      },
      () => ({ data: { id: POLL_ID, slug: "stable-slug" } }),
    );
    expect((await PUT(putReq(), params())).status).toBe(200);
  });
});

describe("DELETE /api/polls/[id] — author-only", () => {
  function wireDelete(user: MockUser, resolve: (table: string, verb: string) => QueryResult) {
    const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
    holder.mock = mock;
    vi.mocked(createClient).mockResolvedValue(mock.client as never);
    return mock;
  }
  const delReq = () => new Request(`http://test/api/polls/${POLL_ID}`, { method: "DELETE" });

  it("401 when unauthenticated", async () => {
    wireDelete(null, () => ({}));
    expect((await DELETE(delReq(), params())).status).toBe(401);
  });

  it("404 when the caller is not the author", async () => {
    wireDelete(authUser, (table) =>
      table === "polls" ? { data: { id: POLL_ID, author_user_id: OTHER_ID } } : {},
    );
    expect((await DELETE(delReq(), params())).status).toBe(404);
  });

  it("deletes the poll when owned", async () => {
    const mock = wireDelete(authUser, (table, verb) => {
      if (table === "polls" && verb === "select") {
        return { data: { id: POLL_ID, author_user_id: USER_ID, cover_image_url: null, cover_image_storage_path: null } };
      }
      return { error: null };
    });
    expect((await DELETE(delReq(), params())).status).toBe(200);
    expect(mock.calls.some((c) => c.table === "polls" && c.verb === "delete")).toBe(true);
  });
});
