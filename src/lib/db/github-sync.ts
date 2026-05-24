import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { fetchRepoFullDetail } from "@/lib/integrations/github";
import { mapRepoToProjectColumns } from "@/lib/integrations/github-mapping";
import type { GithubProjectStats } from "@/lib/constants/github";

export { mapRepoToProjectColumns };

export type SyncProjectResult =
  | { ok: true; syncedAt: string; stats: GithubProjectStats; techStack: string[] }
  | { ok: false; reason: "not_connected" | "not_found" | "no_link" | "update_failed" };

/**
 * Pulls fresh data from GitHub for a project that is already linked to
 * a repository (`github_full_name` set), and writes the result back.
 */
export async function syncProjectFromGitHub(
  supabase: SupabaseClient,
  params: { projectId: string; ownerUserId: string },
): Promise<SyncProjectResult> {
  const integration = await getIntegrationForUser(supabase, params.ownerUserId);
  if (!integration) return { ok: false, reason: "not_connected" };

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, description, project_status, team_size, started_on, github_full_name",
    )
    .eq("id", params.projectId)
    .eq("owner_id", params.ownerUserId)
    .maybeSingle();

  if (!project) return { ok: false, reason: "not_found" };
  if (!project.github_full_name) return { ok: false, reason: "no_link" };

  const detail = await fetchRepoFullDetail(
    integration.access_token,
    project.github_full_name,
  );
  if (!detail) return { ok: false, reason: "not_found" };

  const patch = mapRepoToProjectColumns(detail, {
    description: project.description,
    project_status: project.project_status,
    team_size: project.team_size,
    started_on: project.started_on,
  });

  const { error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.projectId)
    .eq("owner_id", params.ownerUserId);

  if (error) {
    console.error("[github-sync] update failed", error);
    return { ok: false, reason: "update_failed" };
  }

  return {
    ok: true,
    syncedAt: patch.github_synced_at,
    stats: patch.github_stats,
    techStack: patch.tech_stack,
  };
}
