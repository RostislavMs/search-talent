import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));

import { POST as articleView } from "@/app/api/articles/[id]/view/route";
import { POST as pollView } from "@/app/api/polls/[id]/view/route";
import { POST as projectView } from "@/app/api/projects/[id]/view/route";

const ID = "22222222-2222-4222-8222-222222222222";

function setMock(
  resolve: (t: string) => QueryResult,
  rpc: (fn: string) => QueryResult = () => ({ data: 5 }),
) {
  holder.mock = createSupabaseMock({ user: null, resolve: (c) => resolve(c.table), rpc: (fn) => rpc(fn) });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("http://test/view", { method: "POST" });

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

const cases = [
  { name: "articles", handler: articleView, table: "articles", rpcFn: "record_article_view" },
  { name: "polls", handler: pollView, table: "polls", rpcFn: "record_poll_view" },
  { name: "projects", handler: projectView, table: "projects", rpcFn: "record_project_view" },
] as const;

for (const c of cases) {
  describe(`POST /api/${c.name}/[id]/view`, () => {
    it("400 for an invalid id", async () => {
      setMock(() => ({}));
      expect((await c.handler(req(), params("not-a-uuid"))).status).toBe(400);
    });

    it("404 when the entity does not exist", async () => {
      setMock(() => ({ data: null }));
      expect((await c.handler(req(), params(ID))).status).toBe(404);
    });

    it("404 when the entity is not published", async () => {
      setMock(() => ({ data: { id: ID, status: "draft", moderation_status: "approved" } }));
      expect((await c.handler(req(), params(ID))).status).toBe(404);
    });

    it("404 when moderation status is not public", async () => {
      setMock(() => ({ data: { id: ID, status: "published", moderation_status: "under_review" } }));
      expect((await c.handler(req(), params(ID))).status).toBe(404);
    });

    it("records the view and returns the fresh count", async () => {
      const rpc = vi.fn(() => ({ data: 42 }) as QueryResult);
      setMock(
        () => ({ data: { id: ID, status: "published", moderation_status: "approved" } }),
        rpc,
      );
      const res = await c.handler(req(), params(ID));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ viewsCount: 42 });
      expect(rpc).toHaveBeenCalledWith(c.rpcFn);
    });

    it("400 when the RPC errors", async () => {
      setMock(
        () => ({ data: { id: ID, status: "published", moderation_status: "approved" } }),
        () => ({ error: { message: "rpc failed" } }),
      );
      const res = await c.handler(req(), params(ID));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "rpc failed" });
    });
  });
}
