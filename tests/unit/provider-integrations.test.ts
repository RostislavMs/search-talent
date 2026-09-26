import { describe, expect, it } from "vitest";
import {
  getProviderIntegrationsForKind,
  isProviderIntegrationId,
  normalizeIntegrationStats,
  normalizeProjectSourceLink,
  providerIntegrationDescriptors,
  providerIntegrationIds,
} from "@/lib/constants/provider-integrations";
import { projectKinds } from "@/lib/projects";

describe("provider integration registry", () => {
  it("recognises only registered provider ids", () => {
    expect(isProviderIntegrationId("gitlab")).toBe(true);
    // Removed on 2026-09-26: their import carried a title and a link only.
    for (const removed of ["figma", "vimeo", "sketchfab", "notion"]) {
      expect(isProviderIntegrationId(removed)).toBe(false);
    }
    expect(isProviderIntegrationId("github")).toBe(false);
    expect(isProviderIntegrationId(7)).toBe(false);
  });

  it("describes every registered provider with real project kinds", () => {
    for (const id of providerIntegrationIds) {
      const descriptor = providerIntegrationDescriptors[id];
      expect(descriptor.id).toBe(id);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.kinds.length).toBeGreaterThan(0);
      for (const kind of descriptor.kinds) {
        expect(projectKinds).toContain(kind);
      }
    }
  });

  it("routes each project kind to the providers that fit it", () => {
    expect(getProviderIntegrationsForKind("code").map((d) => d.id)).toEqual([
      "gitlab",
    ]);
    expect(getProviderIntegrationsForKind("qa").map((d) => d.id)).toEqual([
      "gitlab",
    ]);
    // Visual and writing work is added by hand or as a pasted media link.
    for (const kind of ["design", "video", "3d", "writing", "photo"] as const) {
      expect(getProviderIntegrationsForKind(kind)).toEqual([]);
    }
    expect(getProviderIntegrationsForKind("")).toEqual([]);
  });

});

describe("normalizeIntegrationStats", () => {
  it("keeps known keys, coerces numbers, drops the rest", () => {
    expect(
      normalizeIntegrationStats([
        { key: "stars", value: 12 },
        { key: "forks", value: "3" },
        { key: "bogus", value: "1" },
        { key: "stars", value: "99" },
        { key: "branch", value: "" },
        "nope",
        null,
      ]),
    ).toEqual([
      { key: "stars", value: "12" },
      { key: "forks", value: "3" },
    ]);
  });

  it("returns an empty list for non-arrays", () => {
    expect(normalizeIntegrationStats(null)).toEqual([]);
    expect(normalizeIntegrationStats({ key: "stars" })).toEqual([]);
  });
});

describe("normalizeProjectSourceLink", () => {
  it("parses a stored link", () => {
    expect(
      normalizeProjectSourceLink({
        provider: "gitlab",
        ref: "group/app",
        externalId: "42",
        name: "App",
        url: "https://gitlab.com/group/app",
        syncedAt: "2026-08-19T10:00:00.000Z",
        stats: [{ key: "stars", value: "5" }],
      }),
    ).toEqual({
      provider: "gitlab",
      ref: "group/app",
      externalId: "42",
      name: "App",
      url: "https://gitlab.com/group/app",
      syncedAt: "2026-08-19T10:00:00.000Z",
      stats: [{ key: "stars", value: "5" }],
    });
  });

  it("tolerates a link that has not synced yet", () => {
    const link = normalizeProjectSourceLink({
      provider: "gitlab",
      ref: "group/app",
    });
    expect(link).toEqual({
      provider: "gitlab",
      ref: "group/app",
      externalId: null,
      name: null,
      url: null,
      syncedAt: null,
      stats: [],
    });
  });

  it("rejects unknown providers, missing refs and junk", () => {
    expect(
      normalizeProjectSourceLink({ provider: "github", ref: "a/b" }),
    ).toBeNull();
    expect(normalizeProjectSourceLink({ provider: "gitlab", ref: "  " })).toBeNull();
    expect(normalizeProjectSourceLink(null)).toBeNull();
    expect(normalizeProjectSourceLink([])).toBeNull();
    expect(normalizeProjectSourceLink("gitlab")).toBeNull();
  });

  it("drops links to providers that were removed", () => {
    expect(
      normalizeProjectSourceLink({ provider: "figma", ref: "abcdefghij123" }),
    ).toBeNull();
  });
});
