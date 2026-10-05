import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GithubIntegrationSummary } from "@/lib/constants/github";
import { createAdminClient } from "@/lib/supabase/admin";

type IntegrationRow = {
  user_id: string;
  github_user_id: number;
  github_login: string;
  github_avatar_url: string | null;
  access_token: string;
  token_type: string;
  scopes: string[] | null;
  connected_at: string;
  updated_at: string;
};

export async function getIntegrationForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("github_integrations")
    .select(
      "user_id, github_user_id, github_login, github_avatar_url, access_token, token_type, scopes, connected_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as IntegrationRow;
}

/**
 * Public-safe projection: omits the access_token so the value can be
 * shipped to the client.
 */
export function toIntegrationSummary(
  row: IntegrationRow,
): GithubIntegrationSummary {
  return {
    githubLogin: row.github_login,
    githubUserId: row.github_user_id,
    githubAvatarUrl: row.github_avatar_url,
    scopes: row.scopes || [],
    connectedAt: row.connected_at,
  };
}

/**
 * Stores the connection after the OAuth code exchange. Clients have no write
 * grant on `github_integrations` (a forged row would earn the GitHub badge and
 * squat someone's `github_user_id`), so only the service key writes here.
 */
export async function upsertIntegration(params: {
  userId: string;
  githubUserId: number;
  githubLogin: string;
  githubAvatarUrl: string | null;
  accessToken: string;
  tokenType: string;
  scopes: string[];
}): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("[github-integrations] upsert skipped: no service key");
    return false;
  }

  const { error } = await admin.from("github_integrations").upsert(
    {
      user_id: params.userId,
      github_user_id: params.githubUserId,
      github_login: params.githubLogin,
      github_avatar_url: params.githubAvatarUrl,
      access_token: params.accessToken,
      token_type: params.tokenType,
      scopes: params.scopes,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[github-integrations] upsert failed", error);
    return false;
  }

  return true;
}

export async function deleteIntegration(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("github_integrations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[github-integrations] delete failed", error);
    return false;
  }

  return true;
}
