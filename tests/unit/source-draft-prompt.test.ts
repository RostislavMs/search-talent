import { describe, expect, it } from "vitest";
import type { IntegrationResourceDetail } from "@/lib/constants/provider-integrations";
import {
  AI_PROJECT_FIELD_LIMITS,
  AI_SOURCE_DESCRIPTION_LIMIT,
} from "@/lib/constants/ai";
import {
  buildSourceDraftPrompt,
  buildSourceDraftSystemInstruction,
  normalizeSourceDraft,
} from "@/lib/ai/source-draft-prompt";

function makeResource(
  overrides: Partial<IntegrationResourceDetail> = {},
): IntegrationResourceDetail {
  return {
    externalId: "123456789",
    ref: "123456789",
    name: "Brand loop",
    description: "A 12-second logo animation",
    url: "https://vimeo.com/123456789",
    meta: null,
    thumbnailUrl: null,
    isPrivate: false,
    homepageUrl: null,
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-08T10:00:00.000Z",
    archived: false,
    teamSize: null,
    tags: ["after effects", "motion"],
    longText: "I animated the mark for a rebrand, using shape layers.",
    stats: [{ key: "duration", value: "0:12" }],
    ...overrides,
  };
}

describe("buildSourceDraftSystemInstruction", () => {
  it("pins the output language", () => {
    expect(buildSourceDraftSystemInstruction("uk")).toContain("Ukrainian");
    expect(buildSourceDraftSystemInstruction("en")).toContain("English");
  });

  it("forbids inventing facts", () => {
    const instruction = buildSourceDraftSystemInstruction("en");
    expect(instruction).toContain("empty string rather than guessing");
    expect(instruction).toContain("Never invent");
  });
});

describe("buildSourceDraftPrompt", () => {
  it("passes the platform facts and long-form text through", () => {
    const prompt = buildSourceDraftPrompt({
      provider: "vimeo",
      resource: makeResource(),
      authorLogin: "kate",
      locale: "en",
      existing: {},
    });

    expect(prompt).toContain("Vimeo");
    expect(prompt).toContain("Brand loop");
    expect(prompt).toContain("after effects, motion");
    expect(prompt).toContain("duration=0:12");
    expect(prompt).toContain("shape layers");
    expect(prompt).toContain("kate");
  });

  it("omits lines the resource has no value for", () => {
    const prompt = buildSourceDraftPrompt({
      provider: "sketchfab",
      resource: makeResource({
        description: null,
        tags: [],
        longText: null,
        stats: [],
      }),
      authorLogin: null,
      locale: "en",
      existing: {},
    });

    expect(prompt).not.toContain("Short description");
    expect(prompt).not.toContain("Tags:");
    expect(prompt).not.toContain("Metrics:");
    expect(prompt).not.toContain("LONG-FORM TEXT");
  });

  it("tells the model to skip fields the author already wrote", () => {
    const prompt = buildSourceDraftPrompt({
      provider: "notion",
      resource: makeResource(),
      authorLogin: null,
      locale: "en",
      existing: { problem: "Already written", results: "   " },
    });

    expect(prompt).toContain("already wrote these fields");
    expect(prompt).toContain("problem");
    // Whitespace does not count as written.
    expect(prompt).not.toContain("problem, results");
  });
});

describe("normalizeSourceDraft", () => {
  it("trims and caps every field", () => {
    const draft = normalizeSourceDraft({
      description: `  ${"d".repeat(AI_SOURCE_DESCRIPTION_LIMIT + 50)}  `,
      projectRole: "  Motion designer  ",
      problem: "x".repeat(AI_PROJECT_FIELD_LIMITS.problem + 10),
      solution: "",
      results: undefined,
    });

    expect(draft.description).toHaveLength(AI_SOURCE_DESCRIPTION_LIMIT);
    expect(draft.description.endsWith("…")).toBe(true);
    expect(draft.projectRole).toBe("Motion designer");
    expect(draft.problem).toHaveLength(AI_PROJECT_FIELD_LIMITS.problem);
    expect(draft.solution).toBe("");
    expect(draft.results).toBe("");
  });
});
