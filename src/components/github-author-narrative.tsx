"use client";

import type { GithubProjectRole } from "@/lib/constants/github";
import { useDictionary } from "@/lib/i18n/client";

type Props = {
  role: GithubProjectRole | null;
  contribution: string | null;
  motivation: string | null;
  techDecisions: string | null;
  learnings: string | null;
  showcaseNotes: string | null;
  productionUsage: string | null;
};

function hasAnything(values: Array<string | null | undefined>): boolean {
  return values.some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function Paragraph({ value }: { value: string }) {
  return (
    <p className="whitespace-pre-line text-sm leading-7 text-[color:var(--foreground)]">
      {value}
    </p>
  );
}

export default function GithubAuthorNarrative({
  role,
  contribution,
  motivation,
  techDecisions,
  learnings,
  showcaseNotes,
  productionUsage,
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.githubIntegration;

  const hasContributionBlock = hasAnything([
    contribution,
    productionUsage,
  ]) || Boolean(role);
  const hasNarrativeBlock = hasAnything([
    motivation,
    techDecisions,
    learnings,
    showcaseNotes,
  ]);

  if (!hasContributionBlock && !hasNarrativeBlock) {
    return null;
  }

  return (
    <div className="space-y-6">
      {hasContributionBlock ? (
        <section
          aria-labelledby="github-contribution-title"
          className="rounded-panel app-card p-5 sm:p-6"
        >
          <h2
            id="github-contribution-title"
            className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]"
          >
            {dict.contributionSectionTitle}
          </h2>

          {role ? (
            <p className="mt-2 text-sm app-muted">
              <span className="font-medium text-[color:var(--foreground)]">
                {dict.roleLabel}:
              </span>{" "}
              {dict.roles[role]}
            </p>
          ) : null}

          {contribution ? (
            <div className="mt-4">
              <Paragraph value={contribution} />
            </div>
          ) : null}

          {productionUsage ? (
            <div className="mt-4 rounded-2xl app-panel px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {dict.productionUsageLabel}
              </p>
              <p className="mt-1 text-sm text-[color:var(--foreground)]">
                {productionUsage}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasNarrativeBlock ? (
        <section
          aria-labelledby="github-narrative-title"
          className="rounded-panel app-card p-5 sm:p-6"
        >
          <h2
            id="github-narrative-title"
            className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]"
          >
            {dict.narrativeSectionTitle}
          </h2>

          <div className="mt-4 space-y-5">
            {motivation ? (
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  {dict.motivationLabel}
                </h3>
                <div className="mt-1.5">
                  <Paragraph value={motivation} />
                </div>
              </div>
            ) : null}

            {techDecisions ? (
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  {dict.techDecisionsLabel}
                </h3>
                <div className="mt-1.5">
                  <Paragraph value={techDecisions} />
                </div>
              </div>
            ) : null}

            {learnings ? (
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  {dict.learningsLabel}
                </h3>
                <div className="mt-1.5">
                  <Paragraph value={learnings} />
                </div>
              </div>
            ) : null}

            {showcaseNotes ? (
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  {dict.showcaseLabel}
                </h3>
                <div className="mt-1.5">
                  <Paragraph value={showcaseNotes} />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
