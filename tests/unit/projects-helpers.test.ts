import { describe, expect, it } from "vitest";
import {
  buildProjectPath,
  generateUniqueProjectSlug,
  getProjectKindLabel,
  normalizeProjectKind,
  normalizeProjectPayload,
  normalizeProjectVisibilityStatus,
  parseProjectPath,
  projectKinds,
  slugify,
} from "@/lib/projects";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

describe("slugify", () => {
  it("kebab-cases ASCII titles", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("collapses repeated dashes and whitespace", () => {
    expect(slugify("Hello   --   World")).toBe("hello-world");
  });

  it("transliterates Ukrainian Cyrillic", () => {
    expect(slugify("Привіт Світ")).toBe("pryvit-svit");
  });

  it("transliterates mixed text", () => {
    expect(slugify("Україна 2024")).toBe("ukrayina-2024");
  });

  it("returns empty string for unslugifiable input", () => {
    expect(slugify("🚀🚀🚀")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("normalizeProjectVisibilityStatus", () => {
  it("returns valid statuses unchanged", () => {
    expect(normalizeProjectVisibilityStatus("draft")).toBe("draft");
    expect(normalizeProjectVisibilityStatus("published")).toBe("published");
  });

  it("falls back to published for unknown/non-string values", () => {
    expect(normalizeProjectVisibilityStatus("archived")).toBe("published");
    expect(normalizeProjectVisibilityStatus(null)).toBe("published");
    expect(normalizeProjectVisibilityStatus(123)).toBe("published");
  });
});

describe("buildProjectPath", () => {
  it("includes the slug when provided", () => {
    expect(buildProjectPath(uuid, "my-project")).toBe(
      `/projects/${uuid}-my-project`,
    );
  });

  it("omits the slug separator for empty/null slug", () => {
    expect(buildProjectPath(uuid)).toBe(`/projects/${uuid}`);
    expect(buildProjectPath(uuid, null)).toBe(`/projects/${uuid}`);
    expect(buildProjectPath(uuid, "")).toBe(`/projects/${uuid}`);
  });
});

describe("parseProjectPath", () => {
  it("extracts id and slug from a uuid-suffixed path segment", () => {
    expect(parseProjectPath(`${uuid}-my-project`)).toEqual({
      id: uuid,
      slug: "my-project",
    });
  });

  it("extracts id with no slug", () => {
    expect(parseProjectPath(uuid)).toEqual({ id: uuid, slug: null });
  });

  it("returns id=null when input is not a UUID", () => {
    expect(parseProjectPath("some-slug-only")).toEqual({
      id: null,
      slug: "some-slug-only",
    });
  });
});

describe("normalizeProjectKind", () => {
  it("returns valid kinds unchanged", () => {
    for (const kind of projectKinds) {
      expect(normalizeProjectKind(kind)).toBe(kind);
    }
  });

  it("returns null for invalid strings", () => {
    expect(normalizeProjectKind("invalid")).toBeNull();
    expect(normalizeProjectKind("")).toBeNull();
  });

  it("returns null for non-string values", () => {
    expect(normalizeProjectKind(null)).toBeNull();
    expect(normalizeProjectKind(42)).toBeNull();
    expect(normalizeProjectKind(undefined)).toBeNull();
  });
});

describe("getProjectKindLabel", () => {
  const mockDictionary = {
    forms: {
      projectKindCode: "Code",
      projectKindDesign: "Design",
      projectKindVideo: "Video",
      projectKindPhoto: "Photo",
      projectKind3d: "3D",
      projectKindMotion: "Motion",
      projectKindAudio: "Audio",
      projectKindQa: "QA",
      projectKindWriting: "Writing",
      projectKindOther: "Other",
    },
  };

  it("returns the correct label for each kind", () => {
    expect(getProjectKindLabel("code", mockDictionary)).toBe("Code");
    expect(getProjectKindLabel("design", mockDictionary)).toBe("Design");
    expect(getProjectKindLabel("video", mockDictionary)).toBe("Video");
    expect(getProjectKindLabel("photo", mockDictionary)).toBe("Photo");
    expect(getProjectKindLabel("3d", mockDictionary)).toBe("3D");
    expect(getProjectKindLabel("motion", mockDictionary)).toBe("Motion");
    expect(getProjectKindLabel("audio", mockDictionary)).toBe("Audio");
    expect(getProjectKindLabel("qa", mockDictionary)).toBe("QA");
    expect(getProjectKindLabel("writing", mockDictionary)).toBe("Writing");
    expect(getProjectKindLabel("other", mockDictionary)).toBe("Other");
  });
});

describe("normalizeProjectPayload", () => {
  it("normalizes a valid full payload", () => {
    const result = normalizeProjectPayload({
      title: "  My Project  ",
      description: "A project",
      role: "Lead Developer",
      projectStatus: "completed",
      teamSize: 5,
      projectUrl: "https://example.com",
      repositoryUrl: "https://github.com/user/repo",
      startedOn: "2024-01-01",
      completedOn: "2024-06-01",
      problem: "Slow loading",
      solution: "Optimized queries",
      results: "50% faster",
      skillIds: [1, 2, 3],
    });

    expect(result.title).toBe("My Project");
    expect(result.slug).toBe("my-project");
    expect(result.projectStatus).toBe("completed");
    expect(result.teamSize).toBe(5);
    expect(result.skillIds).toEqual([1, 2, 3]);
  });

  it("throws for null/non-object body", () => {
    expect(() => normalizeProjectPayload(null)).toThrow("Invalid request body");
    expect(() => normalizeProjectPayload("string")).toThrow("Invalid request body");
  });

  it("throws for missing title", () => {
    expect(() => normalizeProjectPayload({ description: "No title" })).toThrow(
      "Project title is required",
    );
  });

  it("throws for empty title", () => {
    expect(() => normalizeProjectPayload({ title: "   " })).toThrow(
      "Project title is required",
    );
  });

  it("derives slug from title when slug is not provided", () => {
    const result = normalizeProjectPayload({ title: "Hello World" });

    expect(result.slug).toBe("hello-world");
  });

  it("uses explicit slug when provided", () => {
    const result = normalizeProjectPayload({ title: "Hello", slug: "custom-slug" });

    expect(result.slug).toBe("custom-slug");
  });

  it("throws for invalid project status", () => {
    expect(() =>
      normalizeProjectPayload({ title: "X", projectStatus: "invalid" }),
    ).toThrow("Invalid project status");
  });

  it("throws for invalid start date format", () => {
    expect(() =>
      normalizeProjectPayload({ title: "X", startedOn: "2024/01/01" }),
    ).toThrow("Invalid start date");
  });

  it("throws for invalid completion date format", () => {
    expect(() =>
      normalizeProjectPayload({ title: "X", completedOn: "Jan 1 2024" }),
    ).toThrow("Invalid completion date");
  });

  it("throws when completion date is before start date", () => {
    expect(() =>
      normalizeProjectPayload({
        title: "X",
        startedOn: "2024-06-01",
        completedOn: "2024-01-01",
      }),
    ).toThrow("completion date cannot be earlier");
  });

  it("normalizes teamSize from string", () => {
    const result = normalizeProjectPayload({ title: "X", teamSize: "10" });

    expect(result.teamSize).toBe(10);
  });

  it("returns null for invalid teamSize", () => {
    expect(normalizeProjectPayload({ title: "X", teamSize: "abc" }).teamSize).toBeNull();
    expect(normalizeProjectPayload({ title: "X", teamSize: 0 }).teamSize).toBeNull();
    expect(normalizeProjectPayload({ title: "X", teamSize: -5 }).teamSize).toBeNull();
  });

  it("returns null for empty optional text fields", () => {
    const result = normalizeProjectPayload({ title: "X" });

    expect(result.description).toBeNull();
    expect(result.role).toBeNull();
    expect(result.problem).toBeNull();
    expect(result.solution).toBeNull();
    expect(result.results).toBeNull();
    expect(result.projectUrl).toBeNull();
    expect(result.repositoryUrl).toBeNull();
  });

  it("deduplicates and filters skill IDs", () => {
    const result = normalizeProjectPayload({
      title: "X",
      skillIds: [1, 2, 2, 0, -1, "3", "abc"],
    });

    expect(result.skillIds).toEqual([1, 2, 3]);
  });

  it("returns empty array when skillIds is not an array", () => {
    const result = normalizeProjectPayload({ title: "X", skillIds: "not-array" });

    expect(result.skillIds).toEqual([]);
  });
});

describe("generateUniqueProjectSlug", () => {
  function createMockSupabase(existingSlugs: string[]) {
    return {
      from: () => ({
        select: () => ({
          ilike: (..._args: unknown[]) => {
            const result = {
              data: existingSlugs.map((slug) => ({ slug })),
              neq: () => Promise.resolve({
                data: existingSlugs.map((slug) => ({ slug })),
              }),
            };
            // Also make the object itself a thenable
            return Object.assign(Promise.resolve(result), { neq: result.neq });
          },
        }),
      }),
    };
  }

  it("returns base slug when it is not taken", async () => {
    const supabase = createMockSupabase([]);
    const result = await generateUniqueProjectSlug(supabase, "My Project");

    expect(result).toBe("my-project");
  });

  it("appends suffix when base slug is taken", async () => {
    const supabase = createMockSupabase(["my-project"]);
    const result = await generateUniqueProjectSlug(supabase, "My Project");

    expect(result).toBe("my-project-2");
  });

  it("increments suffix until unique", async () => {
    const supabase = createMockSupabase(["my-project", "my-project-2", "my-project-3"]);
    const result = await generateUniqueProjectSlug(supabase, "My Project");

    expect(result).toBe("my-project-4");
  });

  it("falls back to 'project' slug for unslugifiable source", async () => {
    const supabase = createMockSupabase([]);
    const result = await generateUniqueProjectSlug(supabase, "🚀🚀");

    expect(result).toBe("project");
  });

  it("passes excludeProjectId to neq filter", async () => {
    const supabase = createMockSupabase([]);
    const result = await generateUniqueProjectSlug(supabase, "Test", uuid);

    expect(result).toBe("test");
  });
});

