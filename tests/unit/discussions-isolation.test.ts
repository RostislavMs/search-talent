import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type QueryCall,
  type QueryResult,
} from "./helpers/supabase-mock";

const viewerRole = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: async () => viewerRole.current,
}));

const serverClient = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => serverClient.current,
}));

import { getDashboardArticles } from "@/lib/db/articles";
import { getUserArticlesPage } from "@/lib/db/public";
import { DISCUSSIONS_CATEGORY_SLUG, NEWS_CATEGORY_SLUG } from "@/lib/articles";

const DISCUSSIONS_ID = 4;
const NEWS_ID = 9;
const USER_ID = "user-1";

/**
 * Category rows keyed by the slugs a query asked for, so a resolver can tell
 * "give me the section categories" from "give me just discussions".
 */
function categoryRowsFor(call: QueryCall): QueryResult {
  const inFilter = call.filters.find((filter) => filter.method === "in");
  const slugs = (inFilter?.args[1] as string[]) ?? [];
  const rows: Array<{ id: number }> = [];

  if (slugs.includes(NEWS_CATEGORY_SLUG)) rows.push({ id: NEWS_ID });
  if (slugs.includes(DISCUSSIONS_CATEGORY_SLUG)) rows.push({ id: DISCUSSIONS_ID });

  return { data: rows };
}

function articleFilters(calls: QueryCall[]): QueryCall[] {
  return calls.filter((call) => call.table === "articles");
}

describe("discussion topics are hidden from article surfaces", () => {
  it("excludes topics — but not news — from the author's own article list", async () => {
    const mock = createSupabaseMock({
      user: { id: USER_ID },
      resolve: (call) =>
        call.table === "article_categories"
          ? categoryRowsFor(call)
          : { data: [] },
    });
    serverClient.current = mock.client;

    await getDashboardArticles("uk");

    const articlesQuery = articleFilters(mock.calls)[0];

    expect(articlesQuery.filters).toContainEqual({
      method: "or",
      args: [`category_id.is.null,category_id.not.in.(${DISCUSSIONS_ID})`],
    });
    // An admin still manages their News from the same list.
    expect(JSON.stringify(articlesQuery.filters)).not.toContain(
      String(NEWS_ID),
    );
  });

  it("applies the same filter to the count and the page of a profile's articles", async () => {
    const mock = createSupabaseMock({
      user: { id: USER_ID },
      resolve: (call) => {
        if (call.table === "article_categories") return categoryRowsFor(call);
        if (call.table === "profiles") {
          return {
            data: {
              user_id: USER_ID,
              username: "someone",
              name: "Someone",
              avatar_url: null,
              moderation_status: "approved",
            },
          };
        }
        return { data: [], count: 0 };
      },
    });
    serverClient.current = mock.client;

    await getUserArticlesPage("someone", { page: 1, perPage: 10 });

    const queries = articleFilters(mock.calls);
    const expected = {
      method: "or",
      args: [`category_id.is.null,category_id.not.in.(${DISCUSSIONS_ID})`],
    };

    // Both the count query and the rows query, or pagination offers a page of
    // rows that are then filtered away.
    expect(queries.length).toBeGreaterThanOrEqual(2);
    for (const query of queries) {
      expect(query.filters).toContainEqual(expected);
    }
  });
});
