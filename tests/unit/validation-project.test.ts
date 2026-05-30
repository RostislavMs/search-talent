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

describe("projectPayloadSchema – kindMetadata", () => {
  it("accepts a valid design kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Design Project",
      kind: "design",
      kindMetadata: {
        design: {
          role: "ui",
          tools: ["figma"],
          figmaUrl: "https://figma.com/file/abc",
          client: "Acme Corp",
          deliverables: ["logo"],
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.design?.role).toBe("ui");
      expect(result.data.kindMetadata.design?.tools).toEqual(["figma"]);
    }
  });

  it("accepts a valid code kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Code Project",
      kind: "code",
      kindMetadata: {
        code: {
          architecture: "monolith",
          primaryLanguage: "TypeScript",
          hosting: ["Vercel"],
          databases: ["PostgreSQL"],
          license: "MIT",
          docsUrl: "https://docs.example.com",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.code?.architecture).toBe("monolith");
      expect(result.data.kindMetadata.code?.primaryLanguage).toBe("TypeScript");
    }
  });

  it("accepts a valid video kindMetadata with durationSeconds transform", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Video Project",
      kind: "video",
      kindMetadata: {
        video: {
          role: "director",
          tools: ["Premiere Pro"],
          genres: ["documentary"],
          resolution: "4K",
          frameRate: "30",
          durationSeconds: 120,
          client: "Client X",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.video?.durationSeconds).toBe(120);
    }
  });

  it("clamps durationSeconds to max for video", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: {
        video: { durationSeconds: 999999 },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.video?.durationSeconds).toBeLessThanOrEqual(24 * 60 * 60);
    }
  });

  it("accepts valid photo kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Photo Project",
      kind: "photo",
      kindMetadata: {
        photo: {
          role: "photographer",
          genres: ["portrait"],
          cameras: ["Canon"],
          editingTools: ["Lightroom"],
          medium: "digital",
          shotCount: 150,
          location: "Kyiv",
          client: "Magazine X",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.photo?.shotCount).toBe(150);
      expect(result.data.kindMetadata.photo?.medium).toBe("digital");
    }
  });

  it("accepts valid 3D kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "3D Project",
      kind: "3d",
      kindMetadata: {
        threeD: {
          role: "modeling",
          software: ["Blender"],
          renderEngine: "Cycles",
          styles: ["realistic"],
          polygonCount: 50000,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.threeD?.polygonCount).toBe(50000);
    }
  });

  it("accepts valid audio kindMetadata with bpm and musicalKey", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Audio Project",
      kind: "audio",
      kindMetadata: {
        audio: {
          role: "producer",
          genres: ["electronic"],
          daws: ["Ableton Live"],
          durationSeconds: 240,
          bpm: 128,
          musicalKey: "C major",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.audio?.bpm).toBe(128);
      expect(result.data.kindMetadata.audio?.musicalKey).toBe("C major");
    }
  });

  it("clamps bpm to max 400", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: { audio: { bpm: 999 } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.audio?.bpm).toBeLessThanOrEqual(400);
    }
  });

  it("accepts valid QA kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "QA Project",
      kind: "qa",
      kindMetadata: {
        qa: {
          role: "manual_qa",
          testTypes: ["manual"],
          tools: ["Selenium"],
          methodologies: ["agile"],
          testCasesCount: 500,
          bugsFoundCount: 42,
          automationCoveragePercent: 85,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.qa?.testCasesCount).toBe(500);
      expect(result.data.kindMetadata.qa?.automationCoveragePercent).toBe(85);
    }
  });

  it("nullifies automationCoveragePercent outside 0-100", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: { qa: { automationCoveragePercent: 150 } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.qa?.automationCoveragePercent).toBeNull();
    }
  });

  it("accepts valid motion kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Motion Project",
      kind: "motion",
      kindMetadata: {
        motion: {
          role: "motion_designer",
          techniques: ["2d"],
          tools: ["After Effects"],
          purposes: ["commercial"],
          durationSeconds: 60,
          client: "Brand Y",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.motion?.durationSeconds).toBe(60);
    }
  });

  it("accepts valid writing kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "Writing Project",
      kind: "writing",
      kindMetadata: {
        writing: {
          role: "author",
          formats: ["blog_post"],
          topics: ["technology"],
          tools: ["Google Docs"],
          language: "en",
          wordCount: 5000,
          readingTimeMinutes: 15,
          articleUrl: "https://example.com/article",
          client: "Publisher Z",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.writing?.wordCount).toBe(5000);
      expect(result.data.kindMetadata.writing?.readingTimeMinutes).toBe(15);
    }
  });

  it("clamps writing wordCount to max", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: { writing: { wordCount: 999_999_999 } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.writing?.wordCount).toBeLessThanOrEqual(10_000_000);
    }
  });

  it("transforms null kindMetadata to empty object", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata).toEqual({});
    }
  });

  it("transforms empty-string kind to null", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kind: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBeNull();
    }
  });

  it("transforms empty-string enum values in kindMetadata roles to null", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: {
        design: { role: "" },
        code: { architecture: "", primaryLanguage: "" },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.design?.role).toBeNull();
      expect(result.data.kindMetadata.code?.architecture).toBeNull();
      expect(result.data.kindMetadata.code?.primaryLanguage).toBeNull();
    }
  });

  it("nullifies negative or zero numeric values in kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: {
        video: { durationSeconds: -5 },
        photo: { shotCount: 0 },
        audio: { bpm: -1 },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.video?.durationSeconds).toBeNull();
      expect(result.data.kindMetadata.photo?.shotCount).toBeNull();
      expect(result.data.kindMetadata.audio?.bpm).toBeNull();
    }
  });

  it("deduplicates array values in kindMetadata", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      kindMetadata: {
        design: { tools: ["figma", "figma", "sketch"] },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kindMetadata.design?.tools).toEqual(["figma", "sketch"]);
    }
  });
});

describe("projectPayloadSchema – github fields", () => {
  it("normalizes githubFullName", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      githubFullName: "user/repo",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubFullName).toBe("user/repo");
    }
  });

  it("normalizes empty githubFullName to null", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      githubFullName: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubFullName).toBeNull();
    }
  });

  it("defaults githubAutoSync to true", () => {
    const result = projectPayloadSchema.safeParse({ title: "X" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubAutoSync).toBe(true);
    }
  });

  it("normalizes githubDisplayOptions null to null", () => {
    const result = projectPayloadSchema.safeParse({
      title: "X",
      githubDisplayOptions: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.githubDisplayOptions).toBeNull();
    }
  });
});

