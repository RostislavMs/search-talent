import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeProjectSourceLink,
  type ProjectSourceLink,
  type ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";
import { getUsableAccessToken } from "@/lib/db/provider-integrations";
import { mapResourceToProjectColumns } from "@/lib/integrations/provider-mapping";
import { getProviderAdapter } from "@/lib/integrations/provider-registry";

export type ProjectSourceRequest = {
  provider: ProviderIntegrationId;
  ref: string;
  externalId: string | null;
  name: string | null;
  url: string | null;
};

/**
 * Turns a "link this project to <resource>" request from the form into the
 * column patch written on create/update.
 *
 * Best-effort by design, exactly like the GitHub create path: when the
 * provider is unreachable or the token is stale we still store the bare link
 * so the owner can press "Sync now" later instead of losing the connection.
 * Returns null when the request cannot be trusted at all (unknown ref shape,
 * provider not connected for this user).
 */
export async function buildProjectSourceColumns(
  supabase: SupabaseClient,
  userId: string,
  request: ProjectSourceRequest,
  current: {
    description: string | null;
    repository_url?: string | null;
    project_status?: string | null;
    team_size?: number | null;
    started_on?: string | null;
    tech_stack?: string[] | null;
  },
): Promise<Record<string, unknown> | null> {
  const adapter = getProviderAdapter(request.provider);

  if (!adapter.refPattern.test(request.ref)) {
    return null;
  }

  const bareLink: ProjectSourceLink = {
    provider: request.provider,
    ref: request.ref,
    externalId: request.externalId,
    name: request.name,
    url: request.url,
    syncedAt: null,
    stats: [],
  };

  const accessToken = await getUsableAccessToken(
    supabase,
    userId,
    request.provider,
  );

  if (!accessToken) {
    return null;
  }

  const detail = await adapter.fetchResource(accessToken, request.ref);

  if (!detail) {
    return { source_integration: bareLink };
  }

  return mapResourceToProjectColumns(request.provider, detail, current);
}

export type ProviderSyncResult =
  | { ok: true; link: ProjectSourceLink; techStack: string[] }
  | {
      ok: false;
      reason: "not_connected" | "not_found" | "no_link" | "update_failed";
    };

/**
 * Re-pulls a linked project's data from its provider and writes it back.
 * Mirrors `syncProjectFromGitHub`: owner-only, blanks-only for authored text,
 * and a no-op when the project has no source link.
 */
export async function syncProjectFromProvider(
  supabase: SupabaseClient,
  params: { projectId: string; ownerUserId: string },
): Promise<ProviderSyncResult> {
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, description, repository_url, project_status, team_size, started_on, tech_stack, source_integration",
    )
    .eq("id", params.projectId)
    .eq("owner_id", params.ownerUserId)
    .maybeSingle();

  if (!project) return { ok: false, reason: "not_found" };

  const link = normalizeProjectSourceLink(project.source_integration);
  if (!link) return { ok: false, reason: "no_link" };

  // The ref came out of the database, but it was originally client-supplied —
  // re-validate before it is interpolated into a provider URL.
  if (!getProviderAdapter(link.provider).refPattern.test(link.ref)) {
    return { ok: false, reason: "no_link" };
  }

  const accessToken = await getUsableAccessToken(
    supabase,
    params.ownerUserId,
    link.provider,
  );
  if (!accessToken) return { ok: false, reason: "not_connected" };

  const adapter = getProviderAdapter(link.provider);
  const detail = await adapter.fetchResource(accessToken, link.ref);
  if (!detail) return { ok: false, reason: "not_found" };

  const patch = mapResourceToProjectColumns(link.provider, detail, {
    description: project.description,
    repository_url: project.repository_url,
    project_status: project.project_status,
    team_size: project.team_size,
    started_on: project.started_on,
    tech_stack: project.tech_stack,
  });

  const { error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.projectId)
    .eq("owner_id", params.ownerUserId);

  if (error) {
    console.error("[provider-sync] update failed", error);
    return { ok: false, reason: "update_failed" };
  }

  return {
    ok: true,
    link: patch.source_integration,
    techStack: patch.tech_stack,
  };
}
