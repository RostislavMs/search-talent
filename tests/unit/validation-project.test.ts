import { describe, expect, it } from "vitest";
import {
  projectCommentPayloadSchema,
  projectPayloadSchema,
  routeProjectIdSchema,
} from "@/lib/validation/project";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

describe("projectPayloadSchema", () => {
  it("accepts minimal valid payload and derives slug from title", () => {
    const result = projectPayloadSchema.safeParse({ title: "Cool Project" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("cool-project");
      expect(result.data.status).toBe("published");
      expect(result.data.skillIds).toEqual([]);
      expect(result.data.projectStatus).toBeNull();
    }
  });

  it("uses an explicit slug when provided, slugified", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Cool",
      slug: "My Custom Slug!",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("my-custom-slug");
    }
  });

  it("falls back to 'project' slug for unslugifiable titles", () => {
    const result = projectPayloadSchema.safeParse({ title: "🚀" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("project");
    }
  });

  it("rejects empty or too long titles", () => {
    expect(projectPayloadSchema.safeParse({ title: "" }).success).toBe(false);
    expect(projectPayloadSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(
      projectPayloadSchema.safeParse({ title: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("normalizes URLs and rejects invalid ones", () => {
    const ok = projectPayloadSchema.safeParse({
      title: "X",
      projectUrl: "https://example.com",
    });
    expect(ok.success).toBe(true);

    const bad = projectPayloadSchema.safeParse({
      title: "X",
      projectUrl: "not a url",
    });
    expect(bad.success).toBe(false);
  });

  it("dedupes and coerces skill ids, drops invalid", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      skillIds: [1, "2", 2, "x", 0, -3, 3],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillIds.sort()).toEqual([1, 2, 3]);
    }
  });

  it("rejects completion date earlier than start date", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      startedOn: "2024-05-10",
      completedOn: "2024-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts equal start/completion dates", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      startedOn: "2024-01-01",
      completedOn: "2024-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed date strings", () => {
    expect(
      projectPayloadSchema.safeParse({ title: "X", startedOn: "2024/01/01" })
        .success,
    ).toBe(false);
  });

  it("coerces teamSize from string and rejects non-positive", () => {
    const ok = projectPayloadSchema.safeParse({ title: "X", teamSize: "5" });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.teamSize).toBe(5);
    }

    const zero = projectPayloadSchema.safeParse({ title: "X", teamSize: 0 });
    expect(zero.success).toBe(false);
  });

  it("normalizes empty-string projectStatus to null", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      projectStatus: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectStatus).toBeNull();
    }
  });

  it("rejects unknown projectStatus values outright", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      projectStatus: "bogus" as unknown as string,
    });
    expect(result.success).toBe(false);
  });
});

describe("projectCommentPayloadSchema", () => {
  it("requires body", () => {
    expect(projectCommentPayloadSchema.safeParse({ body: "" }).success).toBe(
      false,
    );
  });

  it("accepts a valid comment", () => {
    const result = projectCommentPayloadSchema.safeParse({ body: "Nice work" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parent_id).toBeNull();
    }
  });
});

describe("routeProjectIdSchema", () => {
  it("accepts a UUID", () => {
    expect(routeProjectIdSchema.safeParse({ id: uuid }).success).toBe(true);
  });

  it("rejects non-UUID values", () => {
    expect(routeProjectIdSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});
