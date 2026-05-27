"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
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

  return (
    <section
      aria-labelledby="github-integration-title"
      className="rounded-hero app-card p-6 sm:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="github-integration-title"
            className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]"
          >
            {dict.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm app-muted">
            {dict.description}
          </p>
        </div>
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="text-[color:var(--foreground)] opacity-80"
        >
          <path d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.7 1.1.7 2.1v3.1c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.6 18.4.5 12 .5Z" />
        </svg>
      </header>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-500"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600"
        >
          {success}
        </p>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <p className="text-sm app-muted">{dict.loading}</p>
        ) : integration ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="relative inline-flex h-10 w-10 overflow-hidden rounded-full app-panel">
                {integration.githubAvatarUrl ? (
                  <Image
                    src={integration.githubAvatarUrl}
                    alt={integration.githubLogin}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : null}
              </span>
              <div>
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  @{integration.githubLogin}
                </p>
                <p className="text-xs app-muted">
                  {dict.scopes}: {integration.scopes.join(", ") || "—"}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void disconnect()}
              disabled={pending}
            >
              {pending ? dict.disconnecting : dict.disconnect}
            </Button>
          </div>
        ) : (
          <Button onClick={startConnect}>{dict.connect}</Button>
        )}
      </div>
    </section>
  );
}
