import { describe, expect, it } from "vitest";
import {
  buildGithubDraftPrompt,
  buildGithubDraftSystemInstruction,
  normalizeGithubDraft,
} from "@/lib/ai/github-draft-prompt";
import {
  GITHUB_FIELD_LIMITS,
  type GithubRepoDetail,
} from "@/lib/constants/github";
import { AI_README_CHAR_LIMIT } from "@/lib/constants/ai";

function buildRepo(overrides: Partial<GithubRepoDetail> = {}): GithubRepoDetail {
  return {
    id: 1,
    fullName: "alice/awesome",
    name: "awesome",
    description: "Cool open-source thing",
    htmlUrl: "https://github.com/alice/awesome",
    homepage: "https://awesome.example",
    language: "TypeScript",
    stargazersCount: 12,
    forksCount: 3,
    watchersCount: 5,
    openIssuesCount: 0,
    defaultBranch: "main",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    pushedAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-05-02T10:00:00Z",
    createdAt: "2024-02-01T09:00:00Z",
    topics: ["typescript", "cli"],
    license: { key: "mit", name: "MIT License", spdxId: "MIT" },
    size: 100,
    subscribersCount: 2,
    languages: ["TypeScript", "Shell"],
    languageBreakdown: [
      { name: "TypeScript", bytes: 9000, percent: 90 },
      { name: "Shell", bytes: 1000, percent: 10 },
    ],
    readme: "# Awesome\n\nDoes the thing.",
    contributorsCount: 1,
    latestRelease: null,
    ...overrides,
  };
}

describe("buildGithubDraftSystemInstruction", () => {
  it("requests Ukrainian when locale=uk", () => {
    expect(buildGithubDraftSystemInstruction("uk")).toContain("Ukrainian");
  });
  it("requests English when locale=en", () => {
    expect(buildGithubDraftSystemInstruction("en")).toContain(
      "Reply in English",
    );
  });
});

describe("buildGithubDraftPrompt", () => {
  it("includes the repo identifier, languages, and README", () => {
    const prompt = buildGithubDraftPrompt({
      repo: buildRepo(),
      authorLogin: "alice",
      locale: "en",
      existing: {},
    });

    expect(prompt).toContain("alice/awesome");
    expect(prompt).toContain("TypeScript (90%)");
    expect(prompt).toContain("Does the thing.");
    expect(prompt).toContain("Author's GitHub handle: alice");
  });

  it("caps README to AI_README_CHAR_LIMIT", () => {
    const huge = "x".repeat(AI_README_CHAR_LIMIT + 5000);
    const prompt = buildGithubDraftPrompt({
      repo: buildRepo({ readme: huge }),
      authorLogin: "alice",
      locale: "en",
      existing: {},
    });
    // Prompt must contain at most AI_README_CHAR_LIMIT 'x' characters in a row.
    const longestRun = prompt.match(/x+/)?.[0]?.length ?? 0;
    expect(longestRun).toBeLessThanOrEqual(AI_README_CHAR_LIMIT);
  });

  it("includes existing fields verbatim so the model preserves voice", () => {
    const prompt = buildGithubDraftPrompt({
      repo: buildRepo(),
      authorLogin: "alice",
      locale: "en",
      existing: {
        contribution: "I wrote the CLI parser",
        role: "solo",
      },
    });
    expect(prompt).toContain("contribution: I wrote the CLI parser");
    expect(prompt).toContain("role: solo");
  });

  it("falls back to placeholders for missing optional fields", () => {
    const prompt = buildGithubDraftPrompt({
      repo: buildRepo({
        description: null,
        homepage: null,
        readme: null,
        topics: [],
        license: null,
      }),
      authorLogin: null,
      locale: "en",
      existing: {},
    });
    expect(prompt).toContain("Author's GitHub handle: unknown");
    expect(prompt).toContain("Short description: (none)");
    expect(prompt).toContain("Topics: n/a");
    expect(prompt).toContain("(no README content)");
  });
});

describe("normalizeGithubDraft", () => {
  it("keeps valid role and rejects unknown values", () => {
    expect(normalizeGithubDraft({ role: "solo" }).role).toBe("solo");
    expect(normalizeGithubDraft({ role: "ceo" }).role).toBeNull();
    expect(normalizeGithubDraft({}).role).toBeNull();
  });

  it("trims whitespace and falls back to empty strings", () => {
    const result = normalizeGithubDraft({
      contribution: "  built the auth  ",
      motivation: "",
    });
    expect(result.contribution).toBe("built the auth");
    expect(result.motivation).toBe("");
    expect(result.learnings).toBe("");
  });

  it("truncates over-long output to the column limit", () => {
    const huge = "y".repeat(GITHUB_FIELD_LIMITS.contribution + 100);
    const result = normalizeGithubDraft({ contribution: huge });
    expect(result.contribution.length).toBeLessThanOrEqual(
      GITHUB_FIELD_LIMITS.contribution,
    );
    expect(result.contribution.endsWith("…")).toBe(true);
  });

  it("preserves the new project narrative fields", () => {
    const result = normalizeGithubDraft({
      projectRole: "Solo developer",
      problem: "  scheduling pain  ",
      solution: "  built a calendar  ",
      results: "200 weekly users",
    });
    expect(result.projectRole).toBe("Solo developer");
    expect(result.problem).toBe("scheduling pain");
    expect(result.solution).toBe("built a calendar");
    expect(result.results).toBe("200 weekly users");
  });

  it("returns empty strings for missing project narrative fields", () => {
    const result = normalizeGithubDraft({});
    expect(result.projectRole).toBe("");
    expect(result.problem).toBe("");
    expect(result.solution).toBe("");
    expect(result.results).toBe("");
  });
});
