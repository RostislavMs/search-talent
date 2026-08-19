"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import {
  getProviderIntegrationDescriptor,
  type ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

export type SourceDraftFieldValues = {
  description: string;
  projectRole: string;
  problem: string;
  solution: string;
  results: string;
};

type Props = {
  provider: ProviderIntegrationId;
  ref_: string;
  /** What the author has already written — never overwritten. */
  existing: SourceDraftFieldValues;
  /** Called with the fields the draft filled in. */
  onApply: (draft: SourceDraftFieldValues) => number;
};

/**
 * "Draft with AI" for a project imported from a provider. The same deal as the
 * GitHub draft: the model reads what the platform gave us (title, description,
 * tags, metrics, and the long text — a README, a video description, a Notion
 * page body) and proposes the narrative fields. Only blanks are filled.
 */
export default function SourceAiDraft({
  provider,
  ref_,
  existing,
  onApply,
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.aiDraft;
  const router = useLocalizedRouter();
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<
    | { kind: "ok"; appliedCount: number }
    | { kind: "info" }
    | { kind: "error"; message: string }
    | null
  >(null);

  const generate = async () => {
    setGenerating(true);
    setMessage(null);

    const result = await apiFetch<{ draft: SourceDraftFieldValues }>(
      "/api/ai/source-draft",
      {
        method: "POST",
        body: { provider, ref: ref_, locale: router.locale, existing },
      },
    );

    setGenerating(false);

    if (!result.ok) {
      setMessage({ kind: "error", message: result.error || dict.error });
      return;
    }

    const applied = onApply(result.data.draft);
    setMessage(applied === 0 ? { kind: "info" } : { kind: "ok", appliedCount: applied });
  };

  return (
    <section className="rounded-2xl border border-dashed app-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-[color:var(--foreground)]">
            {dict.title}
          </h4>
          <p className="mt-0.5 text-xs app-muted">
            {dictionary.providerIntegrations.aiDraftHint.replace(
              "{provider}",
              getProviderIntegrationDescriptor(provider).label,
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void generate()}
          disabled={generating}
        >
          {generating ? dict.generating : dict.button}
        </Button>
      </div>

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${
            message.kind === "error" ? "text-rose-500" : "app-muted"
          }`}
        >
          {message.kind === "error"
            ? message.message
            : message.kind === "info"
              ? dict.allFilled
              : dict.applied.replace("{count}", String(message.appliedCount))}
        </p>
      ) : null}
    </section>
  );
}
