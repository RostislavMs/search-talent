import { describe, expect, it } from "vitest";
import {
  createProjectMediaSchema,
  reorderProjectMediaSchema,
  updateProjectMediaSchema,
} from "@/lib/validation/project-media";

const projectId = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";
const mediaId = "1f1f1f1f-2222-4333-8aaa-bbbbcccc0000";

describe("createProjectMediaSchema", () => {
  it("accepts a valid media payload", () => {
    const result = createProjectMediaSchema.safeParse({
      projectId,
      url: "https://example.com/file.png",
      mediaKind: "image",
      storagePath: "media/file.png",
      fileName: "file.png",
      mimeType: "image/png",
      fileSize: 12345,
      sortIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    expect(
      createProjectMediaSchema.safeParse({
        projectId,
        url: "not a url",
        mediaKind: "image",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid project id", () => {
    expect(
      createProjectMediaSchema.safeParse({
        projectId: "nope",
        url: "https://example.com/x",
        mediaKind: "image",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown media kind", () => {
    expect(
      createProjectMediaSchema.safeParse({
        projectId,
        url: "https://example.com/x",
        mediaKind: "audio",
      }).success,
    ).toBe(false);
  });

  it("normalizes negative fileSize / sortIndex to null", () => {
    const result = createProjectMediaSchema.safeParse({
      projectId,
      url: "https://example.com/file.png",
      mediaKind: "file",
      fileSize: -1,
      sortIndex: -2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fileSize).toBeNull();
      expect(result.data.sortIndex).toBeNull();
    }
  });
});

describe("updateProjectMediaSchema", () => {
  it("requires both UUIDs", () => {
    expect(updateProjectMediaSchema.safeParse({ projectId, mediaId }).success)
      .toBe(true);
    expect(
      updateProjectMediaSchema.safeParse({ projectId: "x", mediaId }).success,
    ).toBe(false);
    expect(
      updateProjectMediaSchema.safeParse({ projectId, mediaId: "x" }).success,
    ).toBe(false);
  });
});

describe("reorderProjectMediaSchema", () => {
  it("requires at least one media id", () => {
    expect(
      reorderProjectMediaSchema.safeParse({ projectId, mediaIds: [] }).success,
    ).toBe(false);
  });

  it("accepts a list of UUIDs", () => {
    expect(
      reorderProjectMediaSchema.safeParse({ projectId, mediaIds: [mediaId] })
        .success,
    ).toBe(true);
  });

  it("rejects more than 50 media items", () => {
    const tooMany = Array.from({ length: 51 }, () => mediaId);
    expect(
      reorderProjectMediaSchema.safeParse({ projectId, mediaIds: tooMany })
        .success,
    ).toBe(false);
  });

  it("rejects non-UUID media id", () => {
    expect(
      reorderProjectMediaSchema.safeParse({ projectId, mediaIds: ["nope"] })
        .success,
    ).toBe(false);
  });
});
