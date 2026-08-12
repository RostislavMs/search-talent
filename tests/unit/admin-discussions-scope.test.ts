import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type QueryCall,
  type QueryResult,
} from "./helpers/supabase-mock";

const serverClient = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => serverClient.current,
}));

import { getAdminArticlesList } from "@/lib/db/admin-content";

const DISCUSSIONS_ID = 4;

function setup(options: { categoryExists?: boolean } = {}) {
  const seen: QueryCall[] = [];
  const resolve = (call: QueryCall): QueryResult => {
    seen.push(call);

    if (call.table === "article_categories") {
      return {
        data: options.categoryExists === false ? [] : [{ id: DISCUSSIONS_ID }],
      };
    }

    return { data: [], count: 0 };
  };

  const mock = createSupabaseMock({ user: { id: "admin" }, resolve });
  serverClient.current = mock.client;
  return seen;
}

function articleQueries(seen: QueryCall[]): QueryCall[] {
  return seen.filter((call) => call.table === "articles");
}

describe("admin article scopes", () => {
  it("keeps topics out of the Articles section", async () => {
    const seen = setup();

    await getAdminArticlesList({ scope: "articles" });

    // Rows and status counts must agree, so every articles query carries it.
    const queries = articleQueries(seen);
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(query.filters).toContainEqual({
        method: "or",
        args: [`category_id.is.null,category_id.not.in.(${DISCUSSIONS_ID})`],
      });
    }
  });

  it("limits the Discussions section to topics", async () => {
    const seen = setup();

    await getAdminArticlesList({ scope: "discussions" });

    const queries = articleQueries(seen);
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(query.filters).toContainEqual({
        method: "eq",
        args: ["category_id", DISCUSSIONS_ID],
      });
    }
  });

  it("shows nothing under Discussions until the category migration is applied", async () => {
    const seen = setup({ categoryExists: false });

    await getAdminArticlesList({ scope: "discussions" });

    // A matchless filter beats listing every article under "Discussions".
    for (const query of articleQueries(seen)) {
      expect(query.filters).toContainEqual({
        method: "eq",
        args: ["category_id", -1],
      });
    }
  });

  it("leaves the Articles section unfiltered when there is no topic category", async () => {
    const seen = setup({ categoryExists: false });

    await getAdminArticlesList({ scope: "articles" });

    for (const query of articleQueries(seen)) {
      expect(JSON.stringify(query.filters)).not.toContain("category_id");
    }
  });
});
