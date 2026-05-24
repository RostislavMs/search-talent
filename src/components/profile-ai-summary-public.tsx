"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

type Props = {
  /** Public username of the profile being viewed. */
  username: string;
  /** True only when the viewer is logged in (gates the action). */
  isAuthenticated: boolean;
};

/**
 * Ephemeral AI-summary widget shown on `/u/[username]`.
 *
 * - Nothing is stored. The result lives only in component state until
 *   the page is unmounted (navigation, reload, tab close).
 * - Anonymous viewers don't see the button: it requires login both for
 *   rate-limit attribution and to keep the public surface clean.
 * - Owners use the same flow as everyone else — there's no separate
 *   settings UI any more, because there's nothing to manage.
 */
export default function ProfileAiSummaryPublic({
  username,
  isAuthenticated,
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.aiProfileSummary;
  const router = useLocalizedRouter();

  const [summary, setSummary] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const generate = async () => {
    setWorking(true);
    setError(null);
    const result = await apiFetch<{ summary: string }>(
      "/api/ai/profile-summary",
      {
        method: "POST",
        body: { username, locale: router.locale },
      },
    );
    setWorking(false);
    if (!result.ok) {
      setError(result.error || dict.error);
      return;
    }
    setSummary(result.data.summary);
  };

  const clear = () => {
    setSummary(null);
    setError(null);
  };

  return (
    <div
      className="mt-3 max-w-3xl rounded-2xl app-panel p-3 text-sm leading-7 text-[color:var(--foreground)] sm:mt-4 sm:p-4 sm:text-base"
      aria-label={dict.publicLabel}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-base sm:text-lg">
          ✨
        </span>
        <div className="min-w-0 flex-1">
          {summary ? (
            <p>{summary}</p>
          ) : (
            <p className="app-muted">{dict.publicEmpty}</p>
          )}
          {error ? (
            <p role="alert" className="mt-2 text-xs text-rose-500">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-dashed app-border pt-2">
        <span className="text-[11px] app-soft">{dict.publicHint}</span>
        <div className="flex flex-wrap items-center gap-2">
          {summary ? (
            <Button size="sm" variant="ghost" onClick={clear} disabled={working}>
              {dict.clear}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void generate()}
            disabled={working}
          >
            {working
              ? dict.generating
              : summary
                ? dict.regenerate
                : dict.publicGenerate}
          </Button>
        </div>
      </div>
    </div>
  );
}
