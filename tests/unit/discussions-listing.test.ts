import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type QueryCall,
  type QueryResult,
} from "./helpers/supabase-mock";

const viewerRole = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: async () => viewerRole.current,
}));

import { getDiscussionsListing } from "@/lib/db/discussions";
import { DISCUSSION_COMMENT_THRESHOLD } from "@/lib/discussions";

const CATEGORY_ID = 7;

type Row = Record<string, unknown>;

function setup(
  rows: {
    categoryFound?: boolean;
    topics?: Row[];
    projects?: Row[];
    projectsError?: string;
    articles?: Row[];
    polls?: Row[];
  },
  onCall?: (call: QueryCall) => void,
) {
  const resolve = (call: QueryCall): QueryResult => {
    onCall?.(call);

    if (call.table === "article_categories") {
      return {
        data: rows.categoryFound === false ? null : { id: CATEGORY_ID },
      };
    }

    if (call.table === "projects") {
      return rows.projectsError
        ? { error: { message: rows.projectsError } }
        : { data: rows.projects ?? [] };
    }

    if (call.table === "polls") {
      return { data: rows.polls ?? [] };
    }

    if (call.table === "profiles") {
      return {
        data: [
          {
            user_id: "me",
            username: "me",
            name: "Me",
            avatar_url: null,
          },
        ],
      };
    }

    if (call.table === "articles") {
      // The topics query filters on category_id; the promoted-thread query
      // filters on comments_count.
      const isTopicsQuery = call.filters.some(
        (filter) => filter.method === "eq" && filter.args[0] === "category_id",
      );

      return { data: (isTopicsQuery ? rows.topics : rows.articles) ?? [] };
    }

    return { data: [] };
  };

  const mock = createSupabaseMock({ resolve });
  viewerRole.current = { supabase: mock.client, user: null, isAdmin: false };

  return mock;
}

function contentRow(overrides: Row = {}): Row {
  return {
    id: "id-1",
    slug: "slug-1",
    title: "Title",
    excerpt: null,
    comments_count: DISCUSSION_COMMENT_THRESHOLD,
    moderation_status: "approved",
    published_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getDiscussionsListing", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregates topics and promoted threads into one list", async () => {
    setup({
      topics: [contentRow({ id: "t1", slug: "topic", comments_count: 0 })],
      projects: [
        contentRow({ id: "p1", slug: "proj", description: "desc" }),
      ],
      articles: [contentRow({ id: "a1", slug: "post" })],
      polls: [contentRow({ id: "l1", slug: "poll" })],
    });

    const { items } = await getDiscussionsListing();

    expect(items.map((item) => item.kind).sort()).toEqual([
      "article",
      "poll",
      "project",
      "topic",
    ]);
    expect(items.find((item) => item.kind === "topic")?.href).toBe(
      "/discussions/topic",
    );
    expect(items.find((item) => item.kind === "project")?.href).toBe(
      "/projects/proj/discussion",
    );
    expect(items.find((item) => item.kind === "article")?.href).toBe(
      "/articles/post/discussion",
    );
    expect(items.find((item) => item.kind === "poll")?.href).toBe(
      "/polls/poll/discussion",
    );
  });

  it("sorts newest first so a fresh topic is not buried by busy threads", async () => {
    setup({
      topics: [
        contentRow({
          id: "new-topic",
          slug: "new-topic",
          comments_count: 0,
          published_at: "2026-08-10T00:00:00.000Z",
        }),
      ],
      articles: [
        contentRow({
          id: "old-busy",
          slug: "old-busy",
          comments_count: 99,
          published_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });

    const { items } = await getDiscussionsListing();

    expect(items.map((item) => item.key)).toEqual([
      "topic:new-topic",
      "article:old-busy",
    ]);
  });

  it("keeps topics out of the promoted-article query so they are not listed twice", async () => {
    const seen: QueryCall[] = [];
    setup({ topics: [], articles: [] }, (call) => seen.push(call));

    await getDiscussionsListing();

    const promotedArticles = seen.find(
      (call) =>
        call.table === "articles" &&
        call.filters.some((filter) => filter.method === "gte"),
    );

    expect(promotedArticles?.filters).toContainEqual({
      method: "or",
      args: [`category_id.is.null,category_id.neq.${CATEGORY_ID}`],
    });
  });

  it("hides content that is not publicly visible", async () => {
    setup({
      articles: [
        contentRow({ id: "hidden", slug: "hidden", moderation_status: "removed" }),
        contentRow({ id: "no-slug", slug: null }),
        contentRow({ id: "ok", slug: "ok" }),
      ],
    });

    const { items } = await getDiscussionsListing();

    expect(items.map((item) => item.key)).toEqual(["article:ok"]);
  });

  it("degrades to no project threads when the migration has not been applied", async () => {
    setup({
      projectsError: 'column projects.comments_count does not exist',
      articles: [contentRow({ id: "a1", slug: "post" })],
    });

    const { items } = await getDiscussionsListing();

    // The rest of the page still renders instead of failing outright.
    expect(items.map((item) => item.kind)).toEqual(["article"]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("returns no topics when the discussions category is missing", async () => {
    setup({
      categoryFound: false,
      topics: [contentRow({ id: "t1", slug: "topic" })],
    });

    const { items } = await getDiscussionsListing();

    expect(items).toEqual([]);
  });
});

describe("listing filters and stats", () => {
  function seed() {
    return {
      topics: [contentRow({ id: "t1", slug: "topic", comments_count: 2 })],
      articles: [contentRow({ id: "a1", slug: "post", comments_count: 7 })],
      polls: [contentRow({ id: "l1", slug: "poll", comments_count: 5 })],
    };
  }

  it("narrows the rows by kind", async () => {
    setup(seed());

    const { items } = await getDiscussionsListing({ kind: "poll" });

    expect(items.map((item) => item.kind)).toEqual(["poll"]);
  });

  it("reports totals for the whole listing, not the filtered view", async () => {
    setup(seed());

    const { stats } = await getDiscussionsListing({ kind: "poll" });

    // Otherwise the header numbers would jump around as you click filters.
    expect(stats.topics).toBe(1);
    expect(stats.threads).toBe(2);
    expect(stats.comments).toBe(14);
  });

  it("restricts to one author for the my-discussions page", async () => {
    setup({
      topics: [
        contentRow({ id: "mine", slug: "mine", author_user_id: "me" }),
        contentRow({ id: "theirs", slug: "theirs", author_user_id: "someone" }),
      ],
    });

    const { items } = await getDiscussionsListing({ authorUserId: "me" });

    expect(items.map((item) => item.key)).toEqual(["topic:mine"]);
  });

  it("attaches author profiles in a single lookup", async () => {
    const seen: QueryCall[] = [];
    setup(
      {
        topics: [
          contentRow({ id: "t1", slug: "topic", author_user_id: "me" }),
          contentRow({ id: "t2", slug: "topic-2", author_user_id: "me" }),
        ],
      },
      (call) => seen.push(call),
    );

    const { items } = await getDiscussionsListing();

    const profileQueries = seen.filter((call) => call.table === "profiles");
    expect(profileQueries).toHaveLength(1);
    // Two rows by the same author must not cost two lookups.
    expect(items).toHaveLength(2);
  });
});
