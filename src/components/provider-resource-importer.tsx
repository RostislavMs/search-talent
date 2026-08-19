"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import {
  getProviderIntegrationDescriptor,
  type IntegrationResourceDetail,
  type IntegrationResourceSummary,
  type ProviderIntegrationId,
  type ProviderIntegrationSummary,
} from "@/lib/constants/provider-integrations";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

export type ProviderImportPayload = {
  provider: ProviderIntegrationId;
  resource: IntegrationResourceDetail;
};

type Props = {
  provider: ProviderIntegrationId;
  /** The resource this project is already linked to, if any. */
  linkedName: string | null;
  onImport: (payload: ProviderImportPayload) => void;
  onUnlink: () => void;
  /** Where to land after the OAuth round-trip. */
  returnTo?: string;
};

/**
 * Connect-and-import panel for one provider inside the project wizard.
 *
 * Four states, mirroring the GitHub importer:
 *   not configured → nothing;
 *   not connected  → "Connect <provider>";
 *   connected      → a picker (a list for GitLab, a pasted link for Figma);
 *   linked         → what it is linked to, with an unlink action.
 */
export default function ProviderResourceImporter({
  provider,
  linkedName,
  onImport,
  onUnlink,
  returnTo = "/projects/new",
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.providerIntegrations;
  const router = useLocalizedRouter();
  const descriptor = getProviderIntegrationDescriptor(provider);

  const [integration, setIntegration] = useState<
    ProviderIntegrationSummary | null | "unknown"
  >("unknown");
  const [configured, setConfigured] = useState(true);
  const [resources, setResources] = useState<IntegrationResourceSummary[] | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await apiFetch<{
        integration: ProviderIntegrationSummary | null;
        configured: boolean;
      }>(`/api/integrations/${provider}`);

      if (!result.ok) {
        setConfigured(false);
        setIntegration(null);
        return;
      }

      setConfigured(result.data.configured);
      setIntegration(result.data.integration);
    })();
  }, [provider]);

  const loadResources = useCallback(
    async (searchQuery?: string) => {
      setLoading(true);
      setError(null);

      const suffix = searchQuery
        ? `?q=${encodeURIComponent(searchQuery)}`
        : "";
      const result = await apiFetch<{
        resources: IntegrationResourceSummary[];
      }>(`/api/integrations/${provider}/resources${suffix}`);

      setLoading(false);

      if (!result.ok) {
        setError(result.error || dict.resourcesError);
        return;
      }

      setResources(result.data.resources);
    },
    [dict.resourcesError, provider],
  );

  const togglePanel = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!descriptor.requiresQuery && !resources) {
      void loadResources();
    }
  };

  const startConnect = () => {
    const url = new URL(
      `/api/integrations/${provider}/start`,
      window.location.origin,
    );
    url.searchParams.set("locale", router.locale);
    url.searchParams.set("return_to", returnTo);
    window.location.assign(url.toString());
  };

  const pickResource = async (ref: string) => {
    setImporting(ref);
    setError(null);
    const result = await apiFetch<{ resource: IntegrationResourceDetail }>(
      `/api/integrations/${provider}/resource?ref=${encodeURIComponent(ref)}`,
    );
    setImporting(null);

    if (!result.ok) {
      setError(result.error || dict.resourceError);
      return;
    }

    onImport({ provider, resource: result.data.resource });
    setOpen(false);
  };

  const visibleResources = useMemo(() => {
    if (!resources) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return resources;
    return resources.filter(
      (resource) =>
        resource.name.toLowerCase().includes(needle) ||
        resource.ref.toLowerCase().includes(needle) ||
        (resource.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [filter, resources]);

  if (integration === "unknown" || !configured) {
    return null;
  }

  if (!integration) {
    return (
      <div className="rounded-2xl border border-dashed app-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {dict.importTitle.replace("{provider}", descriptor.label)}
            </p>
            <p className="mt-0.5 text-xs app-muted">
              {dict.notConnectedHint.replace("{provider}", descriptor.label)}
            </p>
          </div>
          <Button size="sm" onClick={startConnect}>
            {dict.connect.replace("{provider}", descriptor.label)}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border app-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {dict.importTitle.replace("{provider}", descriptor.label)}
          </p>
          <p className="mt-0.5 truncate text-xs app-muted">
            {linkedName
              ? dict.linkedTo.replace("{name}", linkedName)
              : dict.connectedAs.replace("{login}", integration.externalLogin)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedName ? (
            <Button size="sm" variant="ghost" onClick={onUnlink}>
              {dict.unlink}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={togglePanel}>
            {open
              ? dict.hidePicker
              : linkedName
                ? dict.pickAnother
                : dict.pickResource.replace("{provider}", descriptor.label)}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          {descriptor.requiresQuery ? (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = query.trim();
                if (trimmed) void loadResources(trimmed);
              }}
            >
              <input
                type="url"
                inputMode="url"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dict.queryPlaceholder}
                aria-label={dict.queryLabel}
                className="app-input flex-1"
              />
              <Button type="submit" variant="secondary" disabled={!query.trim()}>
                {dict.queryAction}
              </Button>
            </form>
          ) : (
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={dict.filterPlaceholder}
              aria-label={dict.filterPlaceholder}
              className="w-full rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
          )}

          {descriptor.requiresQuery ? (
            <p className="text-xs app-soft">{dict.queryHint}</p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-500"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="rounded-xl border app-border px-3 py-4 text-center text-xs app-muted">
              {dict.loadingResources}
            </p>
          ) : resources === null ? null : visibleResources.length === 0 ? (
            <p className="rounded-xl border app-border px-3 py-4 text-center text-xs app-muted">
              {dict.noResources}
            </p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-xl border app-border">
              <ul className="divide-y app-border">
                {visibleResources.map((resource) => (
                  <li key={`${resource.ref}-${resource.externalId}`}>
                    <button
                      type="button"
                      onClick={() => void pickResource(resource.ref)}
                      disabled={importing === resource.ref}
                      className="flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
                        {resource.name}
                        {resource.isPrivate ? (
                          <span className="rounded-full app-panel px-1.5 py-0.5 text-[10px] uppercase app-muted">
                            {dict.privateBadge}
                          </span>
                        ) : null}
                      </span>
                      {resource.description ? (
                        <span className="line-clamp-2 text-xs app-muted">
                          {resource.description}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-3 text-[11px] app-soft">
                        <span className="truncate">{resource.ref}</span>
                        {resource.meta ? <span>{resource.meta}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
