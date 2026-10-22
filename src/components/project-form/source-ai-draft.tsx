"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";
import { aiDraftCopy } from "@/lib/i18n/copy/ai-draft";
import { providerIntegrationsCopy } from "@/lib/i18n/copy/provider-integrations";

export type SourceDraftFieldValues = {
  description: string;
  projectRole: string;
  problem: string;
  solution: string;
  results: string;
};

export type SourceDraftResult =
  /** Every field the draft could fill is already filled; nothing was asked. */
  | { ok: true; outcome: "all_filled" }
  /** `missed`: blank story fields the source said too little about. */
  | { ok: true; outcome: "drafted"; applied: number; missed: number }
  | { ok: false; error: string | null };

type Props = {
  /** The linked source, e.g. "GitHub" or "GitLab". */
  sourceLabel: string;
  /** Asks the model for a draft and writes it into the blank fields. */
  onGenerate: () => Promise<SourceDraftResult>;
};

/**
 * "Draft with AI" for a project imported from a source (a GitHub repository,
 * a GitLab project). The model reads what the source gave us — description,
 * README, languages, tags — and proposes the story, the kind's details and the
 * technology tags. Only blanks are filled. The panel says up front that the
 * model can be wrong and fills less when the source says little, and after a
 * run it tells which of those happened. One panel for every source, so the
 * form reads the same whichever one the author picked.
 */
export default function SourceAiDraft({ sourceLabel, onGenerate }: Props) {
  const dictionary = useDictionary({ aiDraft: aiDraftCopy, providerIntegrations: providerIntegrationsCopy });
  const dict = dictionary.aiDraft;
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<
    | { kind: "status"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  const generate = async () => {
    setGenerating(true);
    setMessage(null);

    const result = await onGenerate();

    setGenerating(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.error || dict.error });
      return;
    }

    if (result.outcome === "all_filled") {
      setMessage({ kind: "status", text: dict.allFilled });
      return;
    }

    const count = String(result.applied);
    setMessage({
      kind: "status",
      text:
        result.applied === 0
          ? dict.noSignal
          : result.missed > 0
            ? dict.appliedPartial.replace("{count}", count)
            : dict.applied.replace("{count}", count),
    });
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
              sourceLabel,
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
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
