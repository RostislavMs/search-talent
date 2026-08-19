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
    expect(isProviderIntegrationId("figma")).toBe(true);
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
    expect(getProviderIntegrationsForKind("design").map((d) => d.id)).toEqual([
      "figma",
    ]);
    expect(getProviderIntegrationsForKind("video").map((d) => d.id)).toEqual([
      "vimeo",
    ]);
    expect(getProviderIntegrationsForKind("3d").map((d) => d.id)).toEqual([
      "sketchfab",
    ]);
    expect(getProviderIntegrationsForKind("writing").map((d) => d.id)).toEqual([
      "notion",
    ]);
    // Photography has no provider with a usable API — Behance and 500px both
    // closed theirs.
    expect(getProviderIntegrationsForKind("photo")).toEqual([]);
    expect(getProviderIntegrationsForKind("")).toEqual([]);
  });

  it("only marks Figma as needing a pasted link", () => {
    expect(providerIntegrationDescriptors.figma.requiresQuery).toBe(true);
    for (const id of providerIntegrationIds) {
      if (id === "figma") continue;
      expect(providerIntegrationDescriptors[id].requiresQuery).toBe(false);
    }
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
      provider: "figma",
      ref: "abcdefghij123",
    });
    expect(link).toEqual({
      provider: "figma",
      ref: "abcdefghij123",
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
});
