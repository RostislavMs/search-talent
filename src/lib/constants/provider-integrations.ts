/**
 * Provider integrations beyond GitHub.
 *
 * GitHub keeps its own bespoke module (`@/lib/constants/github`) because it
 * carries a much richer feature set — README card, contribution narrative,
 * display toggles. Everything added after it goes through this generic layer
 * instead: one OAuth flow, one importer, one sync path, one adapter per
 * provider. Adding a provider means writing an adapter in
 * `@/lib/integrations/<provider>.ts` and registering it — no new routes, no
 * new UI, no migration.
 *
 * This module is client-safe: it holds ids, labels and shapes only. Endpoints,
 * scopes and secrets live in the server-only adapters.
 */

import type { ProjectKind } from "@/lib/projects";

export const providerIntegrationIds = [
  "gitlab",
  "figma",
  "vimeo",
  "sketchfab",
  "notion",
] as const;

export type ProviderIntegrationId = (typeof providerIntegrationIds)[number];

export function isProviderIntegrationId(
  value: unknown,
): value is ProviderIntegrationId {
  return (
    typeof value === "string" &&
    (providerIntegrationIds as readonly string[]).includes(value)
  );
}

/**
 * Stat slots a provider can fill. A closed set keeps the public panel
 * localisable — the adapter supplies values, the dictionary supplies labels,
 * and no provider gets to inject its own English wording.
 */
export const integrationStatKeys = [
  // Repositories
  "stars",
  "forks",
  "openIssues",
  "contributors",
  "branch",
  "languages",
  // Design files
  "pages",
  "components",
  "styles",
  "version",
  // Video
  "duration",
  "plays",
  // 3D
  "faces",
  "vertices",
  "views",
  "likes",
  // Documents
  "words",
  // Shared
  "license",
  "lastActivity",
  "lastModified",
] as const;

export type IntegrationStatKey = (typeof integrationStatKeys)[number];

export type IntegrationStat = {
  key: IntegrationStatKey;
  /** Already formatted for display (counts as strings, dates as ISO). */
  value: string;
};

export type ProviderIntegrationSummary = {
  provider: ProviderIntegrationId;
  externalUserId: string;
  externalLogin: string;
  externalAvatarUrl: string | null;
  scopes: string[];
  connectedAt: string;
};

/** One importable thing inside the provider: a GitLab project, a Figma file. */
export type IntegrationResourceSummary = {
  externalId: string;
  /** Provider-side handle used to re-fetch it (GitLab path, Figma file key). */
  ref: string;
  name: string;
  description: string | null;
  url: string;
  /** Pre-formatted one-liner for the picker row (stars, edit date, …). */
  meta: string | null;
  thumbnailUrl: string | null;
  isPrivate: boolean;
};

export type IntegrationResourceDetail = IntegrationResourceSummary & {
  homepageUrl: string | null;
  /** ISO timestamps as the provider reports them. */
  createdAt: string | null;
  updatedAt: string | null;
  archived: boolean;
  /** Head-count the provider can prove (GitLab contributors). */
  teamSize: number | null;
  /** Languages / topics, matched against the skills catalogue on import. */
  tags: string[];
  /**
   * Whatever long-form text the source carries — a repository README, a video
   * description, a Notion page body. Never stored; it is the raw material the
   * AI draft works from.
   */
  longText: string | null;
  stats: IntegrationStat[];
};

/** What `projects.source_integration` holds. Written server-side only. */
export type ProjectSourceLink = {
  provider: ProviderIntegrationId;
  ref: string;
  externalId: string | null;
  name: string | null;
  url: string | null;
  syncedAt: string | null;
  stats: IntegrationStat[];
};

export type ProviderIntegrationDescriptor = {
  id: ProviderIntegrationId;
  label: string;
  /** Project kinds whose specifics step offers this importer. */
  kinds: readonly ProjectKind[];
  /**
   * true when the provider has no "list everything I own" endpoint, so the
   * picker asks for a pasted link instead of showing a list. Figma is the
   * case: files are only reachable by key, project id or team id.
   */
  requiresQuery: boolean;
};

export const providerIntegrationDescriptors: Record<
  ProviderIntegrationId,
  ProviderIntegrationDescriptor
> = {
  gitlab: {
    id: "gitlab",
    label: "GitLab",
    kinds: ["code", "qa", "other"],
    requiresQuery: false,
  },
  figma: {
    id: "figma",
    label: "Figma",
    kinds: ["design", "motion", "other"],
    requiresQuery: true,
  },
  vimeo: {
    id: "vimeo",
    label: "Vimeo",
    kinds: ["video", "motion", "other"],
    requiresQuery: false,
  },
  sketchfab: {
    id: "sketchfab",
    label: "Sketchfab",
    kinds: ["3d", "motion", "other"],
    requiresQuery: false,
  },
  notion: {
    id: "notion",
    label: "Notion",
    kinds: ["writing", "qa", "other"],
    requiresQuery: false,
  },
};

export function getProviderIntegrationDescriptor(
  provider: ProviderIntegrationId,
): ProviderIntegrationDescriptor {
  return providerIntegrationDescriptors[provider];
}

/** Descriptors offered on the specifics step for a given project kind. */
export function getProviderIntegrationsForKind(
  kind: ProjectKind | "" | null,
): ProviderIntegrationDescriptor[] {
  if (!kind) {
    return [];
  }

  return providerIntegrationIds
    .map((id) => providerIntegrationDescriptors[id])
    .filter((descriptor) => descriptor.kinds.includes(kind));
}

/** Treat a linked project as fresh if it synced within this window. */
export const PROVIDER_AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Hard cap on imported long-form text, mirroring the GitHub README limit. */
export const PROVIDER_LONG_TEXT_CHAR_LIMIT = 50_000;

export function normalizeIntegrationStats(value: unknown): IntegrationStat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<string>(integrationStatKeys);
  const seen = new Set<string>();
  const result: IntegrationStat[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.key !== "string" || !allowed.has(record.key)) {
      continue;
    }
    if (seen.has(record.key)) {
      continue;
    }
    const raw =
      typeof record.value === "string"
        ? record.value
        : typeof record.value === "number"
          ? String(record.value)
          : "";
    if (!raw) {
      continue;
    }
    seen.add(record.key);
    result.push({ key: record.key as IntegrationStatKey, value: raw.slice(0, 200) });
  }

  return result;
}

/** Parses the jsonb column back into a link, or null when absent/corrupt. */
export function normalizeProjectSourceLink(
  value: unknown,
): ProjectSourceLink | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isProviderIntegrationId(record.provider)) {
    return null;
  }

  const ref = typeof record.ref === "string" ? record.ref.trim() : "";

  if (!ref) {
    return null;
  }

  const asText = (input: unknown) =>
    typeof input === "string" && input.trim() ? input.trim() : null;

  return {
    provider: record.provider,
    ref,
    externalId: asText(record.externalId),
    name: asText(record.name),
    url: asText(record.url),
    syncedAt: asText(record.syncedAt),
    stats: normalizeIntegrationStats(record.stats),
  };
}
