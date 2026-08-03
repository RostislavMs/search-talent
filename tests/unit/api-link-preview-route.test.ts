import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null },
}));

// The resolver deliberately reads through the anonymous client, so a preview
// can never expose more than a logged-out visitor already sees.
vi.mock("@/lib/supabase/admin", () => ({
  createPublicReadOnlyClient: vi.fn(() => holder.mock?.client ?? null),
}));

// Composite ratings come from the cached leaderboard snapshot — the same source
// the cards and detail pages read, keyed by profile / project id.
vi.mock("@/lib/db/leaderboards", () => ({
  getCreatorRatings: vi.fn(async () => ({ p1: 62 })),
  getProjectRatings: vi.fn(async () => ({ pr1: 55 })),
}));

import { GET } from "@/app/api/link-preview/route";

function setMock(resolve: (call: QueryCall) => QueryResult) {
  holder.mock = createSupabaseMock({ resolve });
  return holder.mock;
}

const req = (href: string, locale?: string) =>
  new Request(
    `http://test/api/link-preview?href=${encodeURIComponent(href)}${
      locale ? `&locale=${locale}` : ""
    }`,
  );

const published = { status: "published", moderation_status: "approved" };

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/link-preview", () => {
  it("rejects an href that is not a previewable internal route", async () => {
    setMock(() => ({}));
    const res = await GET(req("https://evil.example/u/ada"));

    expect(res.status).toBe(400);
    expect((await res.json()).preview).toBeNull();
    // Nothing may reach the database for a rejected href.
    expect(holder.mock!.calls).toHaveLength(0);
  });

  it("builds a localized profile card", async () => {
    setMock((call) => {
      if (call.table === "profiles") {
        return {
          data: {
            id: "p1",
            user_id: "u1",
            username: "ada",
            name: "Ada Lovelace",
            headline: "Systems engineer",
            avatar_url: "https://cdn.test/ada.png",
            score: 128,
            city: "Kyiv",
            moderation_status: "approved",
            countries: { name: "Ukraine" },
          },
        };
      }
      // Published-content counts, keyed by table.
      if (call.table === "projects") return { count: 8 };
      if (call.table === "articles") return { count: 3 };
      return {};
    });

    const preview = (await (await GET(req("/en/u/ada"))).json()).preview;

    expect(preview).toMatchObject({
      kind: "profile",
      eyebrow: "Profile",
      title: "Ada Lovelace",
      subtitle: "@ada",
      description: "Systems engineer",
      imageShape: "avatar",
      // The composite leaderboard rating, not the persisted Wilson score (128).
      badge: "62 score",
      chips: ["Kyiv, Ukraine", "8 projects", "3 articles"],
    });
  });

  it("counts only published, publicly visible content", async () => {
    const mock = setMock((call) => {
      if (call.table === "profiles") {
        return {
          data: {
            id: "p1",
            user_id: "u1",
            username: "ada",
            name: "Ada",
            headline: null,
            avatar_url: null,
            score: null,
            city: null,
            moderation_status: "approved",
            countries: null,
          },
        };
      }
      return { count: 0 };
    });

    const preview = (await (await GET(req("/en/u/ada"))).json()).preview;

    // A zero count is left off rather than shown as "0 projects".
    expect(preview.chips).toEqual([]);

    const projects = mock.calls.find((call) => call.table === "projects");
    expect(projects?.filters).toEqual([
      { method: "eq", args: ["owner_id", "u1"] },
      { method: "eq", args: ["status", "published"] },
      {
        method: "or",
        args: ["moderation_status.is.null,moderation_status.eq.approved"],
      },
    ]);
    // head:true — the count comes back without any rows crossing the wire.
    expect(projects?.modifiers).toEqual([
      { method: "select", args: ["id", { count: "exact", head: true }] },
    ]);
  });

  it("falls back to the persisted score when the snapshot has no rating yet", async () => {
    setMock((call) =>
      call.table === "profiles"
        ? {
            data: {
              // Not in the mocked leaderboard snapshot.
              id: "brand-new",
              username: "ada",
              name: "Ada",
              headline: null,
              avatar_url: null,
              score: 3,
              city: null,
              moderation_status: "approved",
              countries: null,
            },
          }
        : {},
    );

    const preview = (await (await GET(req("/en/u/ada"))).json()).preview;
    expect(preview.badge).toBe("3 score");
  });

  it("localizes the card from the locale in the href", async () => {
    setMock((call) =>
      call.table === "profiles"
        ? {
            data: {
              // Unrated and unranked: no badge at all.
              id: "p-unranked",
              username: "ada",
              name: null,
              headline: null,
              avatar_url: null,
              score: null,
              city: null,
              moderation_status: "approved",
              countries: null,
            },
          }
        : {},
    );

    const preview = (await (await GET(req("/uk/u/ada"))).json()).preview;

    expect(preview).toMatchObject({
      eyebrow: "Профіль",
      // Falls back to the username when the profile has no display name.
      title: "ada",
      badge: null,
      chips: [],
    });
  });

  it("hides a profile that is not publicly visible", async () => {
    setMock((call) =>
      call.table === "profiles"
        ? {
            data: {
              id: "p1",
              username: "ada",
              name: "Ada",
              headline: null,
              avatar_url: null,
              score: 1,
              city: null,
              moderation_status: "under_review",
              countries: null,
            },
          }
        : {},
    );

    expect((await (await GET(req("/en/u/ada"))).json()).preview).toBeNull();
  });

  it("returns null for a missing target", async () => {
    setMock(() => ({ data: null }));

    expect((await (await GET(req("/en/u/nobody"))).json()).preview).toBeNull();
  });

  it("builds a project card with its kind label and owner byline", async () => {
    setMock((call) => {
      if (call.table === "projects") {
        return {
          data: {
            id: "pr1",
            owner_id: "u1",
            title: "Design system",
            slug: "design-system",
            description: "<p>A shared component library.</p>",
            cover_url: "https://cdn.test/cover.png",
            score: 42,
            kind: "design",
            ...published,
          },
        };
      }
      if (call.table === "profiles") {
        return { data: { name: "Ada", username: "ada" } };
      }
      return {};
    });

    const preview = (await (await GET(req("/en/projects/design-system"))).json())
      .preview;

    expect(preview).toMatchObject({
      kind: "project",
      // Same eyebrow the project cards show site-wide, not a preview-only label.
      eyebrow: "Design (UI / UX / brand)",
      title: "Design system",
      subtitle: "By Ada",
      // Stored HTML is flattened before it reaches the card.
      description: "A shared component library.",
      imageShape: "cover",
      badge: "55 score",
    });
  });

  it("looks a project up by id for the legacy id-slug route", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const mock = setMock((call) =>
      call.table === "projects" ? { data: null } : {},
    );

    await GET(req(`/en/projects/${id}-design-system`));

    const projectCall = mock.calls.find((call) => call.table === "projects");
    expect(projectCall?.filters).toEqual([{ method: "eq", args: ["id", id] }]);
  });

  it("hides an unpublished project", async () => {
    setMock((call) =>
      call.table === "projects"
        ? {
            data: {
              id: "pr1",
              owner_id: "u1",
              title: "Draft",
              slug: "draft",
              description: null,
              cover_url: null,
              score: null,
              kind: null,
              status: "draft",
              moderation_status: "approved",
            },
          }
        : {},
    );

    expect(
      (await (await GET(req("/en/projects/draft"))).json()).preview,
    ).toBeNull();
  });

  it("prefers the translated article fields for the requested locale", async () => {
    setMock((call) => {
      if (call.table === "articles") {
        return {
          data: {
            author_user_id: "u1",
            title: "Українська назва",
            excerpt: "Український опис",
            cover_image_url: "https://cdn.test/uk.png",
            content_locale: "uk",
            translations: {
              en: { title: "English title", excerpt: null },
            },
            published_at: new Date().toISOString(),
            views_count: 12,
            ...published,
          },
        };
      }
      if (call.table === "profiles") {
        return { data: { name: null, username: "ada" } };
      }
      return {};
    });

    const preview = (await (await GET(req("/en/articles/hello"))).json())
      .preview;

    expect(preview).toMatchObject({
      kind: "article",
      eyebrow: "Article",
      title: "English title",
      // The translation carries no excerpt, so the primary one stands in.
      description: "Український опис",
      // …and it has no cover of its own either.
      imageUrl: "https://cdn.test/uk.png",
      subtitle: "By @ada",
    });
    expect(preview.chips).toContain("12 views");
  });

  it("builds a poll card with its response count", async () => {
    setMock((call) => {
      if (call.table === "polls") {
        return {
          data: {
            author_user_id: "u1",
            title: "Best stack?",
            excerpt: "Pick one",
            cover_image_url: null,
            content_locale: "uk",
            translations: null,
            published_at: null,
            responses_count: 7,
            ...published,
          },
        };
      }
      if (call.table === "profiles") {
        return { data: { name: "Ada", username: "ada" } };
      }
      return {};
    });

    const preview = (await (await GET(req("/uk/polls/best-stack"))).json())
      .preview;

    expect(preview).toMatchObject({
      kind: "poll",
      eyebrow: "Опитування",
      title: "Best stack?",
      chips: ["7 відповідей"],
    });
  });

  it("degrades to no card when a query fails", async () => {
    setMock(() => ({ error: { message: "boom" } }));

    const res = await GET(req("/en/u/ada"));
    expect(res.status).toBe(200);
    expect((await res.json()).preview).toBeNull();
  });

  it("marks the response cacheable — it is viewer-independent", async () => {
    setMock(() => ({ data: null }));

    const res = await GET(req("/en/u/ada"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });
});
