import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));

import { POST as articleLike } from "@/app/api/articles/[id]/like/route";
import { POST as pollLike } from "@/app/api/polls/[id]/like/route";
import { rateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}
const params = () => ({ params: Promise.resolve({ id: ID }) });
const req = () => new Request("http://test/x", { method: "POST" });

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

// content table -> like table -> published-parent-column
type LikeCase = { name: string; fn: typeof articleLike; content: string; likeTable: string };
const cases: LikeCase[] = [
  { name: "articles", fn: articleLike, content: "articles", likeTable: "article_likes" },
  { name: "polls", fn: pollLike, content: "polls", likeTable: "poll_likes" },
];

for (const c of cases) {
  describe(`POST /api/${c.name}/[id]/like`, () => {
    const published = { id: ID, status: "published", moderation_status: "approved", likes_count: 5 };

    it("401 when unauthenticated", async () => {
      setMock(null, () => ({}));
      expect((await c.fn(req(), params())).status).toBe(401);
    });

    it("returns the rate-limit response when limited", async () => {
      setMock(authUser, () => ({}));
      vi.mocked(rateLimit).mockReturnValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
      expect((await c.fn(req(), params())).status).toBe(429);
    });

    it("404 when the content is not published/public", async () => {
      setMock(authUser, (table) =>
        table === c.content ? { data: { ...published, status: "draft" } } : {},
      );
      expect((await c.fn(req(), params())).status).toBe(404);
    });

    it("adds a like when none exists", async () => {
      const mock = setMock(authUser, (table, verb) => {
        if (table === c.content) return { data: published };
        if (table === c.likeTable && verb === "select") return { data: null };
        return { error: null };
      });
      const res = await c.fn(req(), params());
      expect((await res.json()).liked).toBe(true);
      expect(mock.calls.some((x) => x.table === c.likeTable && x.verb === "insert")).toBe(true);
    });

    it("removes an existing like (toggle off)", async () => {
      const mock = setMock(authUser, (table, verb) => {
        if (table === c.content) return { data: published };
        if (table === c.likeTable && verb === "select") return { data: { id: "l1" } };
        return { error: null };
      });
      const res = await c.fn(req(), params());
      expect((await res.json()).liked).toBe(false);
      expect(mock.calls.some((x) => x.table === c.likeTable && x.verb === "delete")).toBe(true);
    });
  });
}
