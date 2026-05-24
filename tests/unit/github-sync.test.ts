import { describe, expect, it } from "vitest";
import { mapRepoToProjectColumns } from "@/lib/integrations/github-mapping";
import {
  GITHUB_README_FETCH_CHAR_LIMIT,
  type GithubRepoDetail,
} from "@/lib/constants/github";

function buildRepo(overrides: Partial<GithubRepoDetail> = {}): GithubRepoDetail {
  return {
    id: 9001,
    fullName: "octo/repo",
    name: "repo",
    description: "An octocat repo",
    htmlUrl: "https://github.com/octo/repo",
    homepage: "https://octo.example",
    language: "TypeScript",
    stargazersCount: 42,
    forksCount: 7,
    watchersCount: 13,
    openIssuesCount: 2,
    defaultBranch: "main",
    isPrivate: false,
    isFork: false,
    isArchived: false,
    pushedAt: "2026-05-20T10:00:00Z",
    updatedAt: "2026-05-21T10:00:00Z",
    createdAt: "2024-01-15T09:00:00Z",
    topics: ["typescript", "react"],
    license: { key: "mit", name: "MIT License", spdxId: "MIT" },
    size: 1234,
    subscribersCount: 5,
    languages: ["TypeScript", "CSS"],
    languageBreakdown: [
      { name: "TypeScript", bytes: 8000, percent: 80 },
      { name: "CSS", bytes: 2000, percent: 20 },
    ],
    readme: "# Hello",
    contributorsCount: 4,
    latestRelease: {
      tagName: "v1.2.3",
      name: "Release 1.2.3",
      publishedAt: "2026-04-01T00:00:00Z",
      htmlUrl: "https://github.com/octo/repo/releases/tag/v1.2.3",
      isPrerelease: false,
    },
    ...overrides,
  };
}

const emptyCurrent = {
  description: null,
  project_status: null,
  team_size: null,
  started_on: null,
};

describe("mapRepoToProjectColumns", () => {
  it("populates github columns from the repo detail", () => {
    const result = mapRepoToProjectColumns(buildRepo(), emptyCurrent);

    expect(result.description).toBe("An octocat repo");
    expect(result.github_readme).toBe("# Hello");
    expect(result.project_url).toBe("https://octo.example");
    expect(result.repository_url).toBe("https://github.com/octo/repo");
    expect(result.github_repo_id).toBe(9001);
    expect(result.github_full_name).toBe("octo/repo");
    expect(result.github_default_branch).toBe("main");
    expect(result.github_stats.stars).toBe(42);
    expect(result.github_stats.forks).toBe(7);
    expect(result.github_stats.watchers).toBe(13);
    expect(result.github_stats.openIssues).toBe(2);
    expect(result.github_stats.contributorsCount).toBe(4);
    expect(result.github_stats.license?.spdxId).toBe("MIT");
    expect(result.github_stats.latestRelease?.tagName).toBe("v1.2.3");
    expect(result.github_stats.topics).toEqual(["typescript", "react"]);
    expect(result.github_stats.languageBreakdown).toHaveLength(2);
  });

  it("merges languages and topics into tech_stack (deduped, case-insensitive)", () => {
    const result = mapRepoToProjectColumns(
      buildRepo({
        languages: ["TypeScript", "CSS"],
        topics: ["typescript", "react", "css"],
      }),
      emptyCurrent,
    );
    expect(result.tech_stack).toEqual(["TypeScript", "CSS", "react"]);
  });

  it("derives started_on from createdAt (YYYY-MM-DD)", () => {
    const result = mapRepoToProjectColumns(buildRepo(), emptyCurrent);
    expect(result.started_on).toBe("2024-01-15");
  });

  it("fills team_size from contributors when blank", () => {
    const result = mapRepoToProjectColumns(buildRepo(), emptyCurrent);
    expect(result.team_size).toBe(4);
  });

  it("marks archived repos as completed", () => {
    const result = mapRepoToProjectColumns(
      buildRepo({ isArchived: true }),
      emptyCurrent,
    );
    expect(result.project_status).toBe("completed");
    expect(result.github_stats.archived).toBe(true);
  });

  it("does not overwrite the user's description / status / team_size / started_on", () => {
    const result = mapRepoToProjectColumns(buildRepo({ isArchived: true }), {
      description: "manual",
      project_status: "in_progress",
      team_size: 9,
      started_on: "2023-06-01",
    });

    expect(result.description).toBe("manual");
    expect(result.project_status).toBe("in_progress");
    expect(result.team_size).toBe(9);
    expect(result.started_on).toBe("2023-06-01");
  });

  it("stores README in github_readme without truncation", () => {
    const longReadme = "x".repeat(GITHUB_README_FETCH_CHAR_LIMIT);
    const result = mapRepoToProjectColumns(
      buildRepo({ readme: longReadme }),
      emptyCurrent,
    );
    expect(result.github_readme).toBe(longReadme);
  });

  it("handles missing optional fields gracefully", () => {
    const result = mapRepoToProjectColumns(
      buildRepo({
        createdAt: null,
        topics: [],
        license: null,
        latestRelease: null,
        contributorsCount: 0,
        readme: null,
        description: null,
      }),
      emptyCurrent,
    );

    expect(result.started_on).toBeNull();
    expect(result.team_size).toBeNull();
    expect(result.github_readme).toBeNull();
    expect(result.description).toBeNull();
    expect(result.tech_stack).toEqual(["TypeScript", "CSS"]);
    expect(result.github_stats.license).toBeNull();
    expect(result.github_stats.latestRelease).toBeNull();
  });
});
