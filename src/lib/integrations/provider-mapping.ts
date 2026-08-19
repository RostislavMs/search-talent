import type {
  IntegrationResourceDetail,
  ProjectSourceLink,
  ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";

/**
 * Pure mapping: an imported provider resource → the column patch written to
 * `projects`. Free of the `server-only` import so it can be unit-tested
 * without a database.
 *
 * Same rules as the GitHub mapping, deliberately:
 *   - author-written text is never overwritten, only blanks are filled;
 *   - the README lands in its own column and is never promoted into `solution`;
 *   - an archived source implies project_status = "completed";
 *   - languages + topics merge into `tech_stack`, deduped, order preserved.
 */
export type ProjectSourcePatch = {
  description: string | null;
  repository_url: string | null;
  project_status: string | null;
  team_size: number | null;
  started_on: string | null;
  source_integration: ProjectSourceLink;
  tech_stack: string[];
};

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function buildProjectSourceLink(
  provider: ProviderIntegrationId,
  detail: IntegrationResourceDetail,
  syncedAt: string,
): ProjectSourceLink {
  return {
    provider,
    ref: detail.ref,
    externalId: detail.externalId,
    name: detail.name,
    url: detail.url,
    syncedAt,
    stats: detail.stats,
  };
}

export function mapResourceToProjectColumns(
  provider: ProviderIntegrationId,
  detail: IntegrationResourceDetail,
  current: {
    description: string | null;
    repository_url?: string | null;
    project_status?: string | null;
    team_size?: number | null;
    started_on?: string | null;
    tech_stack?: string[] | null;
  },
): ProjectSourcePatch {
  const techStack: string[] = [];
  const seen = new Set<string>();
  for (const name of [...detail.tags, ...(current.tech_stack || [])]) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    techStack.push(trimmed);
  }

  let startedOn = current.started_on ?? null;
  if (!startedOn) {
    startedOn = toDateOnly(detail.createdAt);
  }

  let projectStatus = current.project_status ?? null;
  if (!projectStatus && detail.archived) {
    projectStatus = "completed";
  }

  let teamSize = current.team_size ?? null;
  if (teamSize === null && detail.teamSize && detail.teamSize > 0) {
    teamSize = detail.teamSize;
  }

  return {
    description:
      current.description && current.description.trim().length > 0
        ? current.description
        : detail.description,
      // A design file or a video is not a repository, so only fill the column
    // when the author left it blank — never clobber a real repo URL.
    repository_url:
      current.repository_url && current.repository_url.trim().length > 0
        ? current.repository_url
        : detail.url,
    project_status: projectStatus,
    team_size: teamSize,
    started_on: startedOn,
    source_integration: buildProjectSourceLink(
      provider,
      detail,
      new Date().toISOString(),
    ),
    tech_stack: techStack,
  };
}
