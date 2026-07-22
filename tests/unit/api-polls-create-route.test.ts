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
vi.mock("@/lib/poll-translations", () => ({ buildSanitizedPollTranslations: () => ({}) }));
vi.mock("@/lib/db/polls", () => ({
  ensureUniquePollSlug: vi.fn(async () => "poll-slug"),
  getPollFeed: vi.fn(),
}));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/auto-moderation", () => ({
  CLEAN_MODERATION_RESULT: { flagged: false, note: "" },
  collectPollModerationText: () => "",
  screenContentForModeration: vi.fn(() => ({ flagged: false, note: "" })),
  describeModerationResult: () => "flagged reason",
}));
vi.mock("@/lib/auto-moderation-apply", () => ({ autoRemoveContent: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/db/co-authors", () => ({ inviteCoAuthors: vi.fn() }));

import { POST } from "@/app/api/polls/route";
import { NextResponse } from "next/server";
import { dbRateLimit } from "@/lib/rate-limit";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { screenContentForModeration } from "@/lib/auto-moderation";
import { autoRemoveContent } from "@/lib/auto-moderation-apply";
import { inviteCoAuthors } from "@/lib/db/co-authors";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CO_AUTHOR = "33333333-3333-4333-8333-333333333333";
const POLL_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

const base = {
  title: "A valid poll title",
  category_slug: "general",
  status: "published" as const,
  questions: [
    { question_type: "single", prompt: "Pick one", options: [{ label: "A" }, { label: "B" }] },
  ],
};

function viewer(
  user: MockUser,
  isAdmin: boolean,
  resolve: (t: string, v: string) => QueryResult,
  rpc?: () => QueryResult,
) {
  const mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb), rpc });
  holder.mock = mock;
  vi.mocked(getCurrentViewerRole).mockResolvedValue({ user: user as never, isAdmin, supabase: mock.client as never } as never);
  return mock;
}

const savedOk = () => ({ data: { id: POLL_ID, slug: "poll-slug" } });
function catResolver(table: string): QueryResult {
  if (table === "poll_categories") return { data: { id: 7, admin_only: false } };
  return { error: null };
}

function req(body: unknown = base): Request {
  return new Request("http://test/api/polls", {
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

describe("POST /api/polls — rate limiting", () => {
  it("429 when the content-creation rate limit trips", async () => {
    viewer(authUser, false, catResolver, savedOk);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "Too many" }, { status: 429 }),
    );
    expect((await POST(req())).status).toBe(429);
  });
});

describe("POST /api/polls — guards", () => {
  it("401 when unauthenticated", async () => {
    viewer(null, false, () => ({}));
    expect((await POST(req())).status).toBe(401);
  });

  it("400 on an invalid payload (no questions)", async () => {
    viewer(authUser, false, catResolver, savedOk);
    expect((await POST(req({ ...base, questions: [] }))).status).toBe(400);
  });

  it("404 when the category is missing", async () => {
    viewer(authUser, false, (table) => (table === "poll_categories" ? { data: null } : {}), savedOk);
    expect((await POST(req())).status).toBe(404);
  });

  it("403 when a non-admin posts in an admin_only category", async () => {
    viewer(authUser, false, (table) =>
      table === "poll_categories" ? { data: { id: 7, admin_only: true } } : {}, savedOk);
    expect((await POST(req())).status).toBe(403);
  });
});

describe("POST /api/polls — creation", () => {
  it("creates the poll via the save_poll RPC", async () => {
    const rpc = vi.fn(savedOk);
    viewer(authUser, false, catResolver, rpc);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalled();
    expect((await res.json()).poll).toMatchObject({ id: POLL_ID, slug: "poll-slug" });
    expect(vi.mocked(inviteCoAuthors)).not.toHaveBeenCalled();
  });

  it("auto-removes flagged content", async () => {
    vi.mocked(screenContentForModeration).mockReturnValue({ flagged: true, note: "bad" } as never);
    viewer(authUser, false, catResolver, savedOk);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(vi.mocked(autoRemoveContent)).toHaveBeenCalledWith({ table: "polls", id: POLL_ID, note: "bad" });
    expect((await res.json()).autoRemoved).toBe(true);
  });

  it("holds as a draft (publish_on_confirm) and invites co-authors", async () => {
    const mock = viewer(authUser, false, catResolver, savedOk);
    const res = await POST(req({ ...base, coAuthorUserIds: [CO_AUTHOR] }));
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "polls" && c.verb === "update")).toBe(true);
    expect(vi.mocked(inviteCoAuthors)).toHaveBeenCalledOnce();
    expect((await res.json()).awaitingCoAuthors).toBe(true);
  });

  it("maps an RPC error to 400", async () => {
    viewer(authUser, false, catResolver, () => ({ error: { message: "rpc boom" } }));
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("rpc boom");
  });
});
