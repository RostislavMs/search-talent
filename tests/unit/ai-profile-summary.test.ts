import { describe, expect, it } from "vitest";
import {
  buildProfileSummaryPrompt,
  buildProfileSummarySystemInstruction,
  normalizeProfileSummary,
  type ProfileSummaryInput,
} from "@/lib/ai/profile-summary-prompt";
import { AI_PROFILE_SUMMARY_CHAR_LIMIT } from "@/lib/constants/ai";

function makeInput(
  overrides: Partial<ProfileSummaryInput> = {},
): ProfileSummaryInput {
  return {
    locale: "en",
    name: "Alice Carter",
    username: "alice",
    headline: "Full-stack engineer",
    bio: "Builds developer tools.",
    additionalInfo: null,
    experienceLevel: "senior",
    experienceYears: 7,
    skills: ["TypeScript", "Postgres"],
    projects: [
      {
        title: "Awesome CLI",
        description: "A CLI for X",
        techStack: ["TypeScript", "Bun"],
      },
    ],
    articles: [{ title: "Why Bun?", excerpt: "Quick rundown of Bun." }],
    ...overrides,
  };
}

describe("buildProfileSummarySystemInstruction", () => {
  it("asks for Ukrainian when locale is uk", () => {
    expect(buildProfileSummarySystemInstruction("uk")).toContain("Ukrainian");
  });

  it("requests two sentences and includes the character cap", () => {
    const instr = buildProfileSummarySystemInstruction("en");
    expect(instr).toContain("2-sentence");
    expect(instr).toContain(String(AI_PROFILE_SUMMARY_CHAR_LIMIT));
  });
});

describe("buildProfileSummaryPrompt", () => {
  it("includes identity, projects, and articles", () => {
    const prompt = buildProfileSummaryPrompt(makeInput());
    expect(prompt).toContain("Alice Carter");
    expect(prompt).toContain("@alice");
    expect(prompt).toContain("Full-stack engineer");
    expect(prompt).toContain("Awesome CLI");
    expect(prompt).toContain("Why Bun?");
  });

  it("falls back to placeholders when projects/articles are empty", () => {
    const prompt = buildProfileSummaryPrompt(
      makeInput({ projects: [], articles: [] }),
    );
    expect(prompt).toContain("(no projects yet)");
    expect(prompt).toContain("(no articles yet)");
  });

  it("omits the additional notes line when absent", () => {
    const prompt = buildProfileSummaryPrompt(
      makeInput({ additionalInfo: null }),
    );
    expect(prompt).not.toContain("Additional notes:");
  });

  it("includes additional notes when present", () => {
    const prompt = buildProfileSummaryPrompt(
      makeInput({ additionalInfo: "Open to contract roles." }),
    );
    expect(prompt).toContain("Additional notes: Open to contract roles.");
  });

  it("caps each project block at 6 entries", () => {
    const projects = Array.from({ length: 12 }, (_, i) => ({
      title: `Project ${i}`,
      description: null,
      techStack: [],
    }));
    const prompt = buildProfileSummaryPrompt(makeInput({ projects }));
    expect(prompt).toContain("6. Project 5");
    expect(prompt).not.toContain("7. Project 6");
  });
});

describe("normalizeProfileSummary", () => {
  it("returns an empty string for empty input", () => {
    expect(normalizeProfileSummary(null)).toBe("");
    expect(normalizeProfileSummary("")).toBe("");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeProfileSummary("  hello\n\nworld  ")).toBe("hello world");
  });

  it("truncates output past the character cap", () => {
    const huge = "y".repeat(AI_PROFILE_SUMMARY_CHAR_LIMIT + 100);
    const result = normalizeProfileSummary(huge);
    expect(result.length).toBeLessThanOrEqual(AI_PROFILE_SUMMARY_CHAR_LIMIT);
    expect(result.endsWith("…")).toBe(true);
  });
});
