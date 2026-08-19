import "server-only";

import type { ProviderIntegrationId } from "@/lib/constants/provider-integrations";
import { getSiteUrl } from "@/lib/seo";
import { figmaAdapter } from "./figma";
import { gitlabAdapter } from "./gitlab";
import { notionAdapter } from "./notion";
import { sketchfabAdapter } from "./sketchfab";
import { vimeoAdapter } from "./vimeo";
import type { ProviderAdapter } from "./provider-types";

const adapters: Record<ProviderIntegrationId, ProviderAdapter> = {
  gitlab: gitlabAdapter,
  figma: figmaAdapter,
  vimeo: vimeoAdapter,
  sketchfab: sketchfabAdapter,
  notion: notionAdapter,
};

export function getProviderAdapter(
  provider: ProviderIntegrationId,
): ProviderAdapter {
  return adapters[provider];
}

export type ProviderCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Every provider shares one callback shape, derived from the site URL. */
export function getProviderRedirectUri(provider: ProviderIntegrationId): string {
  return `${getSiteUrl().replace(/\/$/, "")}/api/integrations/${provider}/callback`;
}

/**
 * OAuth app credentials for a provider, or null when the deployment has not
 * configured it. Callers treat null as "hide the integration" rather than as
 * an error — a self-hosted instance may only wire up some providers.
 */
export function getProviderCredentials(
  provider: ProviderIntegrationId,
): ProviderCredentials | null {
  const adapter = adapters[provider];
  const clientId = process.env[adapter.clientIdEnv];
  const clientSecret = process.env[adapter.clientSecretEnv];

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: getProviderRedirectUri(provider),
  };
}

export function isProviderConfigured(provider: ProviderIntegrationId): boolean {
  return getProviderCredentials(provider) !== null;
}
