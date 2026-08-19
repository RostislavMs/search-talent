import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isProviderIntegrationId,
  type ProviderIntegrationId,
  type ProviderIntegrationSummary,
} from "@/lib/constants/provider-integrations";
import {
  getProviderAdapter,
  getProviderCredentials,
} from "@/lib/integrations/provider-registry";
import type { ProviderTokenSet } from "@/lib/integrations/provider-types";

/**
 * Token storage for the generic provider integrations. One row per
 * (user, provider). Reads are gated by RLS to the owning user, and the token
 * never leaves the server — client routes only ever see
 * `ProviderIntegrationSummary`.
 */

const TABLE = "provider_integrations";

const COLUMNS =
  "user_id, provider, external_user_id, external_login, external_avatar_url, access_token, refresh_token, token_type, expires_at, scopes, connected_at, updated_at";

type IntegrationRow = {
  user_id: string;
  provider: string;
  external_user_id: string;
  external_login: string;
  external_avatar_url: string | null;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string | null;
  scopes: string[] | null;
  connected_at: string;
  updated_at: string;
};

/** Refresh a little early so a long request cannot outlive the token. */
const EXPIRY_SKEW_MS = 60_000;

export async function getProviderIntegration(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderIntegrationId,
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) return null;
  return data as IntegrationRow;
}

export async function listProviderIntegrations(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProviderIntegrationSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId);

  if (error || !data) return [];

  return (data as IntegrationRow[])
    .filter((row) => isProviderIntegrationId(row.provider))
    .map(toProviderIntegrationSummary);
}

/** Public-safe projection: no access or refresh token. */
export function toProviderIntegrationSummary(
  row: IntegrationRow,
): ProviderIntegrationSummary {
  return {
    provider: row.provider as ProviderIntegrationId,
    externalUserId: row.external_user_id,
    externalLogin: row.external_login,
    externalAvatarUrl: row.external_avatar_url,
    scopes: row.scopes || [],
    connectedAt: row.connected_at,
  };
}

export async function upsertProviderIntegration(
  supabase: SupabaseClient,
  params: {
    userId: string;
    provider: ProviderIntegrationId;
    externalUserId: string;
    externalLogin: string;
    externalAvatarUrl: string | null;
    token: ProviderTokenSet;
  },
): Promise<boolean> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: params.userId,
      provider: params.provider,
      external_user_id: params.externalUserId,
      external_login: params.externalLogin,
      external_avatar_url: params.externalAvatarUrl,
      access_token: params.token.accessToken,
      refresh_token: params.token.refreshToken,
      token_type: params.token.tokenType,
      expires_at: params.token.expiresAt,
      scopes: params.token.scopes,
    },
    { onConflict: "user_id,provider" },
  );

  if (error) {
    console.error("[provider-integrations] upsert failed", error);
    return false;
  }

  return true;
}

export async function deleteProviderIntegration(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderIntegrationId,
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    console.error("[provider-integrations] delete failed", error);
    return false;
  }

  return true;
}

/**
 * Returns a token that is good to use right now, refreshing and persisting it
 * first when it has expired. Returns null when the provider is not connected,
 * not configured, or the refresh was rejected — the caller then reports
 * "not connected" and the user reconnects.
 */
export async function getUsableAccessToken(
  supabase: SupabaseClient,
  userId: string,
  provider: ProviderIntegrationId,
): Promise<string | null> {
  const row = await getProviderIntegration(supabase, userId, provider);

  if (!row) {
    return null;
  }

  const expiresAt = row.expires_at ? Date.parse(row.expires_at) : NaN;
  const isExpired =
    Number.isFinite(expiresAt) && expiresAt - EXPIRY_SKEW_MS <= Date.now();

  if (!isExpired) {
    return row.access_token;
  }

  const adapter = getProviderAdapter(provider);
  const credentials = getProviderCredentials(provider);

  if (!adapter.refreshAccessToken || !row.refresh_token || !credentials) {
    return null;
  }

  const refreshed = await adapter.refreshAccessToken({
    refreshToken: row.refresh_token,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri,
  });

  if (!refreshed) {
    return null;
  }

  await upsertProviderIntegration(supabase, {
    userId,
    provider,
    externalUserId: row.external_user_id,
    externalLogin: row.external_login,
    externalAvatarUrl: row.external_avatar_url,
    token: refreshed,
  });

  return refreshed.accessToken;
}
