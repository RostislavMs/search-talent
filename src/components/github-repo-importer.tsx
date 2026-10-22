"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import type {
  GithubIntegrationSummary,
  GithubRepoDetail,
  GithubRepoSummary,
} from "@/lib/constants/github";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { githubIntegrationCopy } from "@/lib/i18n/copy/github-integration";

export type GithubImportPayload = {
  repo: GithubRepoDetail;
};

type Props = {
  /** Called when the user picks a repo and we resolved its details. */
  onImport: (payload: GithubImportPayload) => void;
  /** The repository this project is already linked to, if any. */
  linkedName?: string | null;
  /** Removes the link (applied when the project is saved). */
  onUnlink?: () => void;
  /**
   * Another source this project is already linked to. A project has one
   * source, so the picker stays closed until that one is unlinked.
   */
  blockedBy?: { source: string; name: string } | null;
  /** Optional URL to land on after OAuth (defaults to the new-project page). */
  returnTo?: string;
};

/**
 * Compact panel that lets the project-form caller pick a GitHub repo
 * and pre-fill the form. States:
 *   - blocked → the project already has another source; unlink it first.
 *   - not connected → "Connect GitHub" CTA.
 *   - connected, no pick → list of repositories with search.
 *   - picked → fetch details, hand them to the parent, collapse; the panel
 *     then names the linked repo, offers to pick another or to unlink.
 * Same layout and actions as ProviderResourceImporter (GitLab).
 */
export default function GithubRepoImporter({
  onImport,
  linkedName = null,
  onUnlink,
  blockedBy = null,
  returnTo = "/projects/new",
}: Props) {
  const dictionary = useDictionary({ githubIntegration: githubIntegrationCopy });
  const dict = dictionary.githubIntegration;
  const router = useLocalizedRouter();

  const [integration, setIntegration] = useState<
    GithubIntegrationSummary | null | "unknown"
  >("unknown");
  const [repos, setRepos] = useState<GithubRepoSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await apiFetch<{
        integration: GithubIntegrationSummary | null;
      }>("/api/integrations/github");
      if (!result.ok) {
        setIntegration(null);
        return;
      }
      setIntegration(result.data.integration);
    })();
  }, []);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    const result = await apiFetch<{ repos: GithubRepoSummary[] }>(
      "/api/integrations/github/repos",
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error || dict.reposError);
      return;
    }
    setRepos(result.data.repos);
  };

  const togglePanel = () => {
    if (!open) {
      setOpen(true);
      if (!repos) void loadRepos();
    } else {
      setOpen(false);
    }
  };

  const startConnect = () => {
    const url = new URL("/api/integrations/github/start", window.location.origin);
    url.searchParams.set("locale", router.locale);
    url.searchParams.set("return_to", returnTo);
    window.location.assign(url.toString());
  };

  const pickRepo = async (fullName: string) => {
    setImporting(fullName);
    setError(null);
    const result = await apiFetch<{ repo: GithubRepoDetail }>(
      `/api/integrations/github/repo?fullName=${encodeURIComponent(fullName)}`,
    );
    setImporting(null);
    if (!result.ok) {
      setError(result.error || dict.fetchRepoError);
      return;
    }
    onImport({ repo: result.data.repo });
    setOpen(false);
  };

  const filteredRepos = useMemo(() => {
    if (!repos) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return repos;
    return repos.filter((repo) =>
      repo.fullName.toLowerCase().includes(needle) ||
      (repo.description?.toLowerCase().includes(needle) ?? false),
    );
  }, [repos, filter]);

  if (integration === "unknown") {
    return null;
  }

  if (blockedBy) {
    return (
      <div className="rounded-2xl border border-dashed app-border p-4">
        <p className="text-sm font-medium text-[color:var(--foreground)]">
          {dict.importTitle}
        </p>
        <p className="mt-0.5 text-xs app-muted">
          {dict.blockedBy
            .replace(/\{source\}/g, blockedBy.source)
            .replace("{name}", blockedBy.name)}
        </p>
      </div>
    );
  }

  const unlinkButton =
    linkedName && onUnlink ? (
      <Button size="sm" variant="ghost" onClick={onUnlink}>
        {dict.unlink}
      </Button>
    ) : null;

  if (!integration) {
    return (
      <div className="rounded-2xl border border-dashed app-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {dict.importTitle}
            </p>
            <p className="mt-0.5 truncate text-xs app-muted">
              {linkedName
                ? dict.linkedTo.replace("{name}", linkedName)
                : dict.notConnectedHint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unlinkButton}
            <Button size="sm" onClick={startConnect}>
              {dict.connect}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border app-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {dict.importTitle}
          </p>
          <p className="mt-0.5 truncate text-xs app-muted">
            {linkedName
              ? dict.linkedTo.replace("{name}", linkedName)
              : dict.connectedAs.replace("{login}", integration.githubLogin)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unlinkButton}
          <Button size="sm" variant="secondary" onClick={togglePanel}>
            {open
              ? dict.hideRepos
              : linkedName
                ? dict.pickAnotherRepo
                : dict.pickRepo}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={dict.filterPlaceholder}
            className="w-full rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
          />

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-500"
            >
              {error}
            </p>
          ) : null}

          <div className="max-h-72 overflow-auto rounded-xl border app-border">
            {loading ? (
              <p className="px-3 py-4 text-center text-xs app-muted">
                {dict.loadingRepos}
              </p>
            ) : filteredRepos.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs app-muted">
                {dict.noRepos}
              </p>
            ) : (
              <ul className="divide-y app-border">
                {filteredRepos.map((repo) => (
                  <li key={repo.id}>
                    <button
                      type="button"
                      onClick={() => void pickRepo(repo.fullName)}
                      disabled={importing === repo.fullName}
                      className="flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
                        {repo.fullName}
                        {repo.isPrivate ? (
                          <span className="rounded-full app-panel px-1.5 py-0.5 text-[10px] uppercase app-muted">
                            private
                          </span>
                        ) : null}
                      </span>
                      {repo.description ? (
                        <span className="line-clamp-2 text-xs app-muted">
                          {repo.description}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-3 text-[11px] app-soft">
                        {repo.language ? <span>{repo.language}</span> : null}
                        <span>★ {repo.stargazersCount}</span>
                        <span>⑂ {repo.forksCount}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
