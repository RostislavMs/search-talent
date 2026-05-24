"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import type { GithubProjectStats } from "@/lib/constants/github";

type Props = {
  projectId: string;
  initialSyncedAt: string | null;
};

function relativeTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return locale === "uk" ? "щойно" : "just now";
  if (minutes < 60) {
    return locale === "uk" ? `${minutes} хв тому` : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return locale === "uk" ? `${hours} год тому` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return locale === "uk" ? `${days} дн тому` : `${days}d ago`;
}

export default function GithubSyncButton({ projectId, initialSyncedAt }: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.githubIntegration;
  const router = useRouter();
  const [syncedAt, setSyncedAt] = useState<string | null>(initialSyncedAt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setPending(true);
    setError(null);
    const result = await apiFetch<{
      syncedAt: string;
      stats: GithubProjectStats;
      techStack: string[];
    }>(`/api/projects/${projectId}/sync-github`, { method: "POST" });
    setPending(false);
    if (!result.ok) {
      setError(result.error || dict.syncError);
      return;
    }
    setSyncedAt(result.data.syncedAt);
    router.refresh();
  };

  const localeName =
    dictionary.localeName === "Українська" ? "uk" : "en";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => void handleSync()} disabled={pending}>
        {pending ? dict.syncing : dict.syncNow}
      </Button>
      {syncedAt ? (
        <span className="rounded-full app-panel px-3 py-1 text-xs app-muted">
          {dict.lastSynced}: {relativeTime(syncedAt, localeName)}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-rose-500">
          {error}
        </span>
      ) : null}
    </div>
  );
}
