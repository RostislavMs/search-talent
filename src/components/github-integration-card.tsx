"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import IntegrationCard from "@/components/integration-card";
import { apiFetch } from "@/lib/api-client";
import type { GithubIntegrationSummary } from "@/lib/constants/github";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

type Props = {
  /** Optional URL to land on after the OAuth round-trip. */
  returnTo?: string;
};

export default function GithubIntegrationCard({
  returnTo = "/profile/edit",
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.githubIntegration;
  const router = useLocalizedRouter();
  const [integration, setIntegration] =
    useState<GithubIntegrationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<{
      integration: GithubIntegrationSummary | null;
    }>("/api/integrations/github");
    setLoading(false);
    if (!result.ok) {
      setError(dict.loadError);
      return;
    }
    setIntegration(result.data.integration);
  }, [dict.loadError]);

  useEffect(() => {
    // Defer the initial fetch off the effect tick so it doesn't count
    // as a synchronous setState call.
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  // Surface success/error from the OAuth round-trip (?github=success|error).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("github");
    if (!status) return;
    const message = params.get("message") || "";

    params.delete("github");
    params.delete("message");
    const next = params.toString();
    const cleaned = `${window.location.pathname}${next ? `?${next}` : ""}`;
    window.history.replaceState({}, "", cleaned);

    queueMicrotask(() => {
      if (status === "success") setSuccess(dict.connectedMessage);
      else setError(dict.connectError.replace("{code}", message));
    });
  }, [dict.connectedMessage, dict.connectError]);

  const startConnect = () => {
    const url = new URL("/api/integrations/github/start", window.location.origin);
    url.searchParams.set("locale", router.locale);
    url.searchParams.set("return_to", returnTo);
    window.location.assign(url.toString());
  };

  const disconnect = async () => {
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await apiFetch("/api/integrations/github", {
      method: "DELETE",
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error || dict.disconnectError);
      return;
    }
    setIntegration(null);
    setSuccess(dict.disconnectedMessage);
  };

  const status = loading
    ? dict.loading
    : integration
      ? `@${integration.githubLogin}`
      : dict.description;

  return (
    <IntegrationCard
      brand="github"
      name={dict.title}
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
            disabled={loading}
          >
            {dict.connect}
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
