import { describe, expect, it } from "vitest";
import {
  buildDetailsPromptSection,
  getDetailDraftFields,
  MAX_DRAFT_TECHNOLOGIES,
  normalizeDetailsDraft,
} from "@/lib/ai/project-details-draft";
import { buildGithubDraftPrompt } from "@/lib/ai/github-draft-prompt";
import { buildSourceDraftPrompt } from "@/lib/ai/source-draft-prompt";
import type { GithubRepoDetail } from "@/lib/constants/github";

const facts = {
  languages: ["TypeScript", "CSS"],
  license: "MIT",
  sourceText: "Docs: https://docs.example.com/app\nDeployed on Vercel.",
};

describe("getDetailDraftFields", () => {
  it("asks for the code details and the tags on a code project", () => {
    const keys = getDetailDraftFields("code").map((field) => field.key);
    expect(keys).toContain("codeArchitecture");
    expect(keys).toContain("codeLicense");
    expect(keys).toContain("technologies");
  });

  it("asks for the QA details on a QA project", () => {
    const keys = getDetailDraftFields("qa").map((field) => field.key);
    expect(keys).toEqual(expect.arrayContaining(["qaTestTypes", "qaTools", "technologies"]));
    expect(keys).not.toContain("codeArchitecture");
  });

  it("asks only for the tags when the kind has no details to draft", () => {
    expect(getDetailDraftFields("other").map((field) => field.key)).toEqual(["technologies"]);
    expect(getDetailDraftFields(null).map((field) => field.key)).toEqual(["technologies"]);
  });
});

describe("buildDetailsPromptSection", () => {
  it("lists the allowed values so the model picks from them", () => {
    const section = buildDetailsPromptSection("code");
    expect(section).toContain("web_app");
    expect(section).toContain("PostgreSQL");
    expect(section).toContain("Never guess hosting, databases or links");
  });
});

describe("normalizeDetailsDraft", () => {
  it("keeps only values from the lists, matching case-insensitively", () => {
    const { details } = normalizeDetailsDraft(
      "code",
      {
        codeArchitecture: "WEB_APP",
        codeHosting: ["vercel", "Heroku-ish", "vercel"],
        codeDatabases: ["postgresql"],
      },
      facts,
    );
    expect(details.code).toMatchObject({
      architecture: "web_app",
      hosting: ["Vercel"],
      databases: ["PostgreSQL"],
    });
  });

  it("takes the language and the license from the source, not the model", () => {
    const { details } = normalizeDetailsDraft(
      "code",
      { codePrimaryLanguage: "Python", codeLicense: "GPL-3.0" },
      facts,
    );
    expect(details.code?.primaryLanguage).toBe("TypeScript");
    expect(details.code?.license).toBe("MIT");
  });

  it("reads a license given by its display name", () => {
    const { details } = normalizeDetailsDraft("code", {}, { ...facts, license: "MIT License" });
    expect(details.code?.license).toBe("MIT");
  });

  it("never invents a license for a source that has none", () => {
    const { details } = normalizeDetailsDraft("code", { codeLicense: "MIT" }, { ...facts, license: null });
    expect(details.code?.license).toBeNull();
  });

  it("falls back to the model's language when the source languages are not in the list", () => {
    const { details } = normalizeDetailsDraft(
      "code",
      { codePrimaryLanguage: "Go" },
      { ...facts, languages: ["HCL", "Makefile"] },
    );
    expect(details.code?.primaryLanguage).toBe("Go");
  });

  it("keeps a link only when it is in the source text", () => {
    const { details } = normalizeDetailsDraft(
      "code",
      {
        codeDocsUrl: "https://docs.example.com/app",
        codeStorybookUrl: "https://storybook.example.com",
        codeApiPlaygroundUrl: "not a url",
      },
      facts,
    );
    expect(details.code).toMatchObject({
      docsUrl: "https://docs.example.com/app",
      storybookUrl: null,
      apiPlaygroundUrl: null,
    });
  });

  it("fills the QA details on a QA project", () => {
    const { details } = normalizeDetailsDraft(
      "qa",
      { qaRole: "automation_qa", qaTools: ["playwright", "Nope"], qaTestTypes: ["e2e"] },
      facts,
    );
    expect(details.code).toBeUndefined();
    expect(details.qa).toMatchObject({
      role: "automation_qa",
      tools: ["Playwright"],
      testTypes: ["e2e"],
    });
  });

  it("dedupes and caps the technology tags", () => {
    const many = Array.from({ length: 20 }, (_, index) => `Tool ${index}`);
    const { technologies } = normalizeDetailsDraft(
      "other",
      { technologies: ["React", "react", " ", ...many] },
      facts,
    );
    expect(technologies[0]).toBe("React");
    expect(technologies.filter((name) => name.toLowerCase() === "react")).toHaveLength(1);
    expect(technologies).toHaveLength(MAX_DRAFT_TECHNOLOGIES);
  });
});

describe("draft prompts with a kind", () => {
  const repo = {
    fullName: "alice/app",
    description: null,
    homepage: null,
    license: null,
    createdAt: null,
    pushedAt: null,
    latestRelease: null,
    stargazersCount: 0,
    forksCount: 0,
    contributorsCount: 1,
    languageBreakdown: [],
    topics: [],
    isArchived: false,
    isFork: false,
    readme: null,
  } as unknown as GithubRepoDetail;

  it("adds the details section only when the kind is given", () => {
    const base = { repo, authorLogin: null, locale: "en" as const, existing: {} };
    expect(buildGithubDraftPrompt(base)).not.toContain("PROJECT DETAILS");
    expect(buildGithubDraftPrompt({ ...base, kind: "code" })).toContain("codeArchitecture");
  });

  it("adds it to the provider prompt as well", () => {
    const prompt = buildSourceDraftPrompt({
      provider: "gitlab",
      resource: {
        externalId: "1",
        ref: "me/app",
        name: "app",
        description: null,
        url: "https://gitlab.com/me/app",
        meta: null,
        thumbnailUrl: null,
        isPrivate: false,
        homepageUrl: null,
        createdAt: null,
        updatedAt: null,
        archived: false,
        teamSize: null,
        tags: [],
        longText: null,
        stats: [],
      },
      authorLogin: null,
      locale: "en",
      existing: {},
      kind: "qa",
    });
    expect(prompt).toContain("qaTestTypes");
  });
});
