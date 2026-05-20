import { describe, expect, it } from "vitest";
import {
  buildProjectPath,
  normalizeProjectVisibilityStatus,
  parseProjectPath,
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
