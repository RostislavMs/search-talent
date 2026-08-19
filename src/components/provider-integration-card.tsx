"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import IntegrationCard from "@/components/integration-card";
import { apiFetch } from "@/lib/api-client";
import {
  getProviderIntegrationDescriptor,
  type ProviderIntegrationId,
  type ProviderIntegrationSummary,
} from "@/lib/constants/provider-integrations";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

type Props = {
  provider: ProviderIntegrationId;
  /** Where the OAuth round-trip should land. */
  returnTo?: string;
};

type ProviderDict = ReturnType<typeof useDictionary>["providerIntegrations"];

/** Each provider explains its own import in its own words. */
function providerDescription(
  provider: ProviderIntegrationId,
  dict: ProviderDict,
): string {
  switch (provider) {
    case "gitlab":
      return dict.gitlabDescription;
    case "figma":
      return dict.figmaDescription;
    case "vimeo":
      return dict.vimeoDescription;
    case "sketchfab":
      return dict.sketchfabDescription;
    case "notion":
      return dict.notionDescription;
    default:
      return "";
  }
}

/**
 * Connect / disconnect card for one provider, shown in the profile's
 * Integrations grid next to the GitHub card. Renders nothing when the
 * deployment has no OAuth app configured for the provider — an unusable
 * "Connect" button is worse than no card.
 */
export default function ProviderIntegrationCard({
  provider,
  returnTo = "/profile/edit",
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.providerIntegrations;
  const router = useLocalizedRouter();
  const descriptor = getProviderIntegrationDescriptor(provider);

  const [integration, setIntegration] =
    useState<ProviderIntegrationSummary | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<{
      integration: ProviderIntegrationSummary | null;
      configured: boolean;
    }>(`/api/integrations/${provider}`);

    if (!result.ok) {
      setConfigured(false);
      setError(dict.loadError);
      return;
    }

    setConfigured(result.data.configured);
    setIntegration(result.data.integration);
  }, [dict.loadError, provider]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // Surface the OAuth outcome (?integration=<id>&status=success|error) and
  // scrub it out of the URL so a refresh does not replay the message.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("integration") !== provider) return;

    const status = params.get("status");
    if (!status) return;
    const message = params.get("message") || "";

    params.delete("integration");
    params.delete("status");
    params.delete("message");
    const next = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}`,
    );

    queueMicrotask(() => {
      if (status === "success") {
        setSuccess(dict.connectedMessage.replace("{provider}", descriptor.label));
      } else {
        setError(
          dict.connectError
            .replace("{provider}", descriptor.label)
            .replace("{code}", message),
        );
      }
    });
  }, [descriptor.label, dict.connectError, dict.connectedMessage, provider]);

  const startConnect = () => {
    const url = new URL(
      `/api/integrations/${provider}/start`,
      window.location.origin,
    );
    url.searchParams.set("locale", router.locale);
    url.searchParams.set("return_to", returnTo);
    window.location.assign(url.toString());
  };

  const disconnect = async () => {
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await apiFetch(`/api/integrations/${provider}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error || dict.disconnectError);
      return;
    }

    setIntegration(null);
    setSuccess(dict.disconnectedMessage.replace("{provider}", descriptor.label));
  };

  if (configured === false) {
    return null;
  }

  const status =
    configured === null
      ? dict.loading
      : integration
        ? integration.externalLogin
        : providerDescription(provider, dict);

  return (
    <IntegrationCard
      brand={provider}
      name={descriptor.label}
      status={status}
      action={
        integration ? (
          <Button
            variant="secondary"
            className="w-full justify-center"
            onClick={() => void disconnect()}
            disabled={pending}
          >
            {pending ? dict.disconnecting : dict.disconnect}
          </Button>
        ) : (
          <Button
            className="w-full justify-center"
            onClick={startConnect}
            disabled={configured === null}
          >
            {dict.connect.replace("{provider}", descriptor.label)}
          </Button>
        )
      }
      message={
        error ? (
          <p role="alert" className="mt-3 text-xs text-rose-500">
            {error}
          </p>
        ) : success ? (
          <p role="status" className="mt-3 text-xs text-emerald-600">
            {success}
          </p>
        ) : null
      }
    />
  );
}
