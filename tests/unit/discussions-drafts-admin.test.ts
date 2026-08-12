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

import { getDiscussionsListing } from "@/lib/db/discussions";
import { getAdminCommentsList } from "@/lib/db/admin-content";
import {
  collectArticleModerationText,
  screenContentForModeration,
} from "@/lib/auto-moderation";

const CATEGORY_ID = 7;
const VIEWER_ID = "viewer-1";

function topicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    slug: "topic",
    title: "Topic",
    excerpt: null,
    comments_count: 0,
    moderation_status: "approved",
    published_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("draft topics on /discussions", () => {
  function setup(user: { id: string } | null, onCall?: (c: QueryCall) => void) {
    const resolve = (call: QueryCall): QueryResult => {
      onCall?.(call);

      if (call.table === "article_categories") {
        return { data: { id: CATEGORY_ID } };
      }

      if (call.table === "articles") {
        const isDraftQuery = call.filters.some(
          (filter) =>
            filter.method === "eq" &&
            filter.args[0] === "status" &&
            filter.args[1] === "draft",
        );

        return {
          data: isDraftQuery
            ? [topicRow({ id: "d1", slug: "my-draft", title: "My draft" })]
            : [topicRow({ id: "p1", slug: "published", title: "Published" })],
        };
      }

      return { data: [] };
    };

    const mock = createSupabaseMock({ user, resolve });
    viewerRole.current = { supabase: mock.client, user, isAdmin: false };
    return mock;
  }

  it("puts the viewer's own drafts above published threads", async () => {
    setup({ id: VIEWER_ID });

    const { items } = await getDiscussionsListing();

    expect(items[0]?.title).toBe("My draft");
    expect(items[0]?.isDraft).toBe(true);
    expect(items.some((item) => item.title === "Published")).toBe(true);
  });

  it("scopes the draft query to the signed-in author", async () => {
    const seen: QueryCall[] = [];
    setup({ id: VIEWER_ID }, (call) => seen.push(call));

    await getDiscussionsListing();

    const draftQuery = seen.find(
      (call) =>
        call.table === "articles" &&
        call.filters.some(
          (filter) =>
            filter.method === "eq" &&
            filter.args[0] === "status" &&
            filter.args[1] === "draft",
        ),
    );

    expect(draftQuery?.filters).toContainEqual({
      method: "eq",
      args: ["author_user_id", VIEWER_ID],
    });
  });

  it("never queries drafts for an anonymous visitor", async () => {
    const seen: QueryCall[] = [];
    setup(null, (call) => seen.push(call));

    const { items } = await getDiscussionsListing();

    expect(items.every((item) => !item.isDraft)).toBe(true);
    expect(
      seen.some((call) =>
        call.filters.some(
          (filter) =>
            filter.method === "eq" &&
            filter.args[0] === "status" &&
            filter.args[1] === "draft",
        ),
      ),
    ).toBe(false);
  });
});

describe("admin comment moderation", () => {
  it("covers poll comments, which the old two-source merge left invisible", async () => {
    const seen: QueryCall[] = [];
    const mock = createSupabaseMock({
      user: { id: "admin" },
      resolve: (call) => {
        seen.push(call);
        if (call.table === "poll_comments") {
          return {
            data: [
              {
                id: "c1",
                poll_id: "poll-1",
                author_user_id: "u1",
                body: "hi",
                media_url: null,
                created_at: "2026-08-02T00:00:00.000Z",
              },
            ],
            count: 1,
          };
        }
        if (call.table === "polls") {
          return { data: [{ id: "poll-1", title: "A poll", slug: "a-poll" }] };
        }
        return { data: [], count: 0 };
      },
    });
    serverClient.current = mock.client;

    const result = await getAdminCommentsList();

    expect(seen.map((call) => call.table)).toContain("poll_comments");

    const pollComment = result.items.find((item) => item.kind === "poll");
    expect(pollComment?.targetLabel).toBe("A poll");
    expect(pollComment?.targetHref).toBe("/polls/a-poll");
  });

  it("queries only the requested kind when filtered", async () => {
    const seen: QueryCall[] = [];
    const mock = createSupabaseMock({
      user: { id: "admin" },
      resolve: (call) => {
        seen.push(call);
        return { data: [], count: 0 };
      },
    });
    serverClient.current = mock.client;

    await getAdminCommentsList({ kind: "poll" });

    const commentTables = seen
      .map((call) => call.table)
      .filter((table) => table.endsWith("_comments"));

    expect(commentTables).toEqual(["poll_comments"]);
  });
});

describe("auto-moderation applies to topics", () => {
  // Topics are saved through the articles route, so they inherit its screening.
  // This pins that the screened text actually includes a topic's two fields.
  it("screens the title and the body of a topic payload", () => {
    const parts = collectArticleModerationText({
      title: "Title",
      excerpt: null,
      content: "<p>Body</p>",
      translations: {},
    });

    expect(parts).toContain("Title");
    expect(parts).toContain("<p>Body</p>");
  });

  it("returns a clean verdict for ordinary text", () => {
    const screen = screenContentForModeration(
      collectArticleModerationText({
        title: "Як обрати стек для пет-проєкту",
        excerpt: null,
        content: "<p>Розкажіть, що використовуєте і чому.</p>",
        translations: {},
      }),
    );

    expect(screen.flagged).toBe(false);
  });
});
