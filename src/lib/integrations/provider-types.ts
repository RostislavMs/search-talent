import type {
  IntegrationResourceDetail,
  IntegrationResourceSummary,
  ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";

/** OAuth result, normalised across providers. */
export type ProviderTokenSet = {
  accessToken: string;
  tokenType: string;
  refreshToken: string | null;
  /** ISO timestamp, or null for tokens that do not expire. */
  expiresAt: string | null;
  scopes: string[];
};

export type ProviderAccount = {
  id: string;
  login: string;
  avatarUrl: string | null;
};

/**
 * Everything a provider must supply. The OAuth routes, the importer, the sync
 * job and the project panel are all written against this interface, so a new
 * provider is one file plus one line in the registry.
 */
export type ProviderAdapter = {
  id: ProviderIntegrationId;
  scopes: string[];
  /** Env var names holding the OAuth app credentials. */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Validates the `ref` handle before it reaches the provider's API. */
  refPattern: RegExp;

  buildAuthorizeUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
  }): string;

  exchangeCodeForToken(params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<ProviderTokenSet | null>;

  /** Omitted by providers whose tokens never expire. */
  refreshAccessToken?(params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<ProviderTokenSet | null>;

  fetchAccount(accessToken: string): Promise<ProviderAccount | null>;

  /** Everything the account owns that can be imported. */
  listResources(accessToken: string): Promise<IntegrationResourceSummary[]>;

  fetchResource(
    accessToken: string,
    ref: string,
  ): Promise<IntegrationResourceDetail | null>;
};
