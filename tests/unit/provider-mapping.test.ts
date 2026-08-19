import { describe, expect, it } from "vitest";
import type { IntegrationResourceDetail } from "@/lib/constants/provider-integrations";
import { mapResourceToProjectColumns } from "@/lib/integrations/provider-mapping";

function makeDetail(
  overrides: Partial<IntegrationResourceDetail> = {},
): IntegrationResourceDetail {
  return {
    externalId: "42",
    ref: "group/app",
    name: "App",
    description: "Imported description",
    url: "https://gitlab.com/group/app",
    meta: null,
    thumbnailUrl: null,
    isPrivate: false,
    homepageUrl: null,
    createdAt: "2024-03-04T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    archived: false,
    teamSize: 4,
    tags: ["TypeScript", "nextjs"],
    longText: "# App",
    stats: [{ key: "stars", value: "12" }],
    ...overrides,
  };
}

describe("mapResourceToProjectColumns", () => {
  it("fills blank columns from the provider", () => {
    const patch = mapResourceToProjectColumns("gitlab", makeDetail(), {
      description: null,
    });

    expect(patch.description).toBe("Imported description");
    expect(patch.repository_url).toBe("https://gitlab.com/group/app");
    expect(patch.started_on).toBe("2024-03-04");
    expect(patch.team_size).toBe(4);
    expect(patch.tech_stack).toEqual(["TypeScript", "nextjs"]);
  });

  it("never overwrites what the author already wrote", () => {
    const patch = mapResourceToProjectColumns("gitlab", makeDetail(), {
      description: "My own words",
      repository_url: "https://github.com/me/app",
      project_status: "in_progress",
      team_size: 1,
      started_on: "2020-01-01",
    });

    expect(patch.description).toBe("My own words");
    expect(patch.repository_url).toBe("https://github.com/me/app");
    expect(patch.project_status).toBe("in_progress");
    expect(patch.team_size).toBe(1);
    expect(patch.started_on).toBe("2020-01-01");
  });

  it("treats an archived source as a completed project, but only when blank", () => {
    expect(
      mapResourceToProjectColumns("gitlab", makeDetail({ archived: true }), {
        description: null,
      }).project_status,
    ).toBe("completed");

    expect(
      mapResourceToProjectColumns("gitlab", makeDetail({ archived: true }), {
        description: null,
        project_status: "on_hold",
      }).project_status,
    ).toBe("on_hold");
  });

  it("merges provider tags ahead of existing tech stack, deduped case-insensitively", () => {
    const patch = mapResourceToProjectColumns("gitlab", makeDetail(), {
      description: null,
      tech_stack: ["typescript", "Docker"],
    });

    expect(patch.tech_stack).toEqual(["TypeScript", "nextjs", "Docker"]);
  });

  it("records the link with the resource identity and stats", () => {
    const patch = mapResourceToProjectColumns("figma", makeDetail({
      ref: "abcdefghij123",
      url: "https://www.figma.com/design/abcdefghij123",
      stats: [{ key: "pages", value: "3" }],
    }), { description: null });

    expect(patch.source_integration.provider).toBe("figma");
    expect(patch.source_integration.ref).toBe("abcdefghij123");
    expect(patch.source_integration.stats).toEqual([
      { key: "pages", value: "3" },
    ]);
    expect(patch.source_integration.syncedAt).toBeTruthy();
  });

  it("leaves the timeline alone when the provider reports no dates", () => {
    const patch = mapResourceToProjectColumns(
      "figma",
      makeDetail({ createdAt: null, teamSize: null }),
      { description: null },
    );

    expect(patch.started_on).toBeNull();
    expect(patch.team_size).toBeNull();
  });
});
