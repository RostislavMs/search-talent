import { describe, expect, it } from "vitest";
import {
  pickHeroExample,
  toExampleTheme,
  type ExampleCandidate,
  type ExampleProject,
} from "@/lib/home-example";
import {
  createDefaultProfilePresentation,
  type ProfilePresentation,
} from "@/lib/profile-presentation";

const THEME = toExampleTheme(createDefaultProfilePresentation());

function candidate(userId: string, overrides: Partial<ExampleCandidate> = {}): ExampleCandidate {
  return {
    profileId: `profile-${userId}`,
    userId,
    username: userId,
    name: userId.toUpperCase(),
    headline: null,
    avatarUrl: null,
    categoryName: null,
    rating: 10,
    projectCount: 0,
    theme: THEME,
    ...overrides,
  };
}

function projects(ownerId: string, count: number, withCover = true, kind = "video"): ExampleProject[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${ownerId}-${index}`,
    ownerId,
    title: `${ownerId} project ${index}`,
    slug: null,
    coverUrl: withCover ? `https://cdn.test/${ownerId}-${index}.webp` : null,
    kind,
  }));
}

const NO_ADMINS = new Set<string>();

describe("pickHeroExample", () => {
  it("returns null without candidates", () => {
    expect(pickHeroExample({ candidates: [], projects: [], adminUserIds: NO_ADMINS })).toBeNull();
  });

  it("prefers a non-admin with a full set of covers over a higher-ranked admin", () => {
    const example = pickHeroExample({
      candidates: [
        candidate("founder", { rating: 55 }),
        candidate("editor", { rating: 21, categoryName: "Content Creation" }),
      ],
      projects: [...projects("founder", 8, true, "code"), ...projects("editor", 21)],
      adminUserIds: new Set(["founder"]),
    });

    expect(example?.username).toBe("editor");
    expect(example?.categoryName).toBe("Content Creation");
    expect(example?.covers).toHaveLength(3);
    expect(example?.covers[0].kind).toBe("video");
    expect(example?.projectCount).toBe(21);
  });

  it("falls back to an admin with covers when no one else has enough", () => {
    const example = pickHeroExample({
      candidates: [candidate("newbie"), candidate("founder")],
      projects: [...projects("newbie", 1), ...projects("founder", 4, true, "code")],
      adminUserIds: new Set(["founder"]),
    });
    expect(example?.username).toBe("founder");
  });

  it("keeps the leaderboard order within a tier", () => {
    const example = pickHeroExample({
      candidates: [candidate("first"), candidate("second")],
      projects: [...projects("second", 5), ...projects("first", 3)],
      adminUserIds: NO_ADMINS,
    });
    expect(example?.username).toBe("first");
  });

  it("uses someone with a single cover before someone with none", () => {
    const example = pickHeroExample({
      candidates: [candidate("bare"), candidate("one")],
      projects: [...projects("bare", 4, false), ...projects("one", 1)],
      adminUserIds: NO_ADMINS,
    });
    expect(example?.username).toBe("one");
    expect(example?.covers).toHaveLength(1);
  });

  it("still returns the top candidate when nobody has covers", () => {
    const example = pickHeroExample({
      candidates: [candidate("a"), candidate("b")],
      projects: projects("b", 2, false),
      adminUserIds: NO_ADMINS,
    });
    expect(example?.username).toBe("a");
    expect(example?.covers).toEqual([]);
  });

  it("keeps the given project order and drops unknown kinds", () => {
    const example = pickHeroExample({
      candidates: [candidate("mixed")],
      projects: [
        { id: "a", ownerId: "mixed", title: "a", slug: null, coverUrl: "https://cdn.test/a", kind: "design" },
        { id: "b", ownerId: "mixed", title: "b", slug: null, coverUrl: null, kind: "code" },
        { id: "c", ownerId: "mixed", title: "c", slug: null, coverUrl: "https://cdn.test/c", kind: "nonsense" },
        { id: "d", ownerId: "mixed", title: "d", slug: null, coverUrl: "https://cdn.test/d", kind: "code" },
      ],
      adminUserIds: NO_ADMINS,
    });

    expect(example?.covers.map((cover) => [cover.id, cover.kind])).toEqual([
      ["a", "design"],
      ["c", null],
      ["d", "code"],
    ]);
  });
});

describe("toExampleTheme", () => {
  function presentation(overrides: Partial<ProfilePresentation>): ProfilePresentation {
    return { ...createDefaultProfilePresentation(), ...overrides };
  }

  it("carries the author's colours and font", () => {
    const theme = toExampleTheme(
      presentation({ accentColor: "#6800bd", fontPreset: "technical", textColor: "#ffffff" }),
    );
    expect(theme.accent).toBe("#6800bd");
    expect(theme.text).toBe("#ffffff");
    expect(theme.fontFamily).toContain("monospace");
    expect(theme.heroBackground).toContain("linear-gradient");
    expect(theme.heroImageUrl).toBeNull();
    expect(theme.heroOverlay).toBeNull();
  });

  it("puts a background photo behind a readable wash", () => {
    const theme = toExampleTheme(
      presentation({ backgroundMode: "image", backgroundUrl: "https://cdn.test/bg.jpg" }),
    );
    expect(theme.heroImageUrl).toBe("https://cdn.test/bg.jpg");
    expect(theme.heroOverlay).toContain("linear-gradient");
  });

  it("stands in for a background video with its base colour, not the video", () => {
    const theme = toExampleTheme(
      presentation({
        backgroundMode: "video",
        backgroundUrl: "https://cdn.test/bg.mp4",
        solidColor: "#101010",
      }),
    );
    expect(theme.heroImageUrl).toBeNull();
    expect(theme.heroBackground).toBe("#101010");
    expect(theme.heroOverlay).not.toBeNull();
  });

  it("survives a JSON round trip, as the cache stores it", () => {
    const theme = toExampleTheme(presentation({ cardStyle: "glass" }));
    expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);
  });
});
