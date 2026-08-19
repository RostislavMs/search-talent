import type { ProviderIntegrationId } from "@/lib/constants/provider-integrations";

/** One short-lived state cookie per provider, so two flows cannot collide. */
export function providerStateCookieName(provider: ProviderIntegrationId) {
  return `pi_state_${provider}`;
}

/** How long the CSRF state stays valid — long enough to log in at the provider. */
export const PROVIDER_OAUTH_STATE_TTL_SECONDS = 600;
