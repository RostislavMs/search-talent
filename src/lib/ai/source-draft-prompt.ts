import type {
  IntegrationResourceDetail,
  ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";
import { getProviderIntegrationDescriptor } from "@/lib/constants/provider-integrations";
import {
  AI_PROJECT_FIELD_LIMITS,
  AI_README_CHAR_LIMIT,
  AI_SOURCE_DESCRIPTION_LIMIT,
} from "@/lib/constants/ai";

/**
 * Pure prompt construction for the provider-import draft. Mirrors
 * `github-draft-prompt` — no `server-only` import, so it stays unit-testable
 * without the Gemini SDK.
 *
 * Where the GitHub draft also writes the repo-specific narrative columns, a
 * provider import only has the standard project fields to fill.
 */

export type SourceDraftFields = {
  description: string;
  projectRole: string;
  problem: string;
  solution: string;
  results: string;
};

export type SourceDraftPromptInput = {
  provider: ProviderIntegrationId;
  resource: IntegrationResourceDetail;
  authorLogin: string | null;
  locale: "uk" | "en";
  existing: Partial<SourceDraftFields>;
};

export function buildSourceDraftSystemInstruction(
  locale: "uk" | "en",
): string {
  const langLine =
    locale === "uk"
      ? "Reply in Ukrainian (українською мовою)."
      : "Reply in English.";

  return [
    "You help creators describe their work on a talent-discovery platform called SearchTalent.",
    "Your output drafts the narrative fields of a public project page that peers and the community will read.",
    "Write in first person from the AUTHOR's perspective ('I designed…', 'I shot…', 'I built…').",
    "Be concrete and specific. Avoid hype, buzzwords, and generic phrasing like 'cutting-edge' or 'leveraged'.",
    "If a piece of information is not supported by the input, return an empty string rather than guessing.",
    "Never invent view counts, clients, dates, or outcomes that aren't in the input.",
    langLine,
  ].join(" ");
}

/** One "Label: value" line, skipped entirely when there is no value. */
function line(label: string, value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

export function buildSourceDraftPrompt(input: SourceDraftPromptInput): string {
  const { provider, resource, authorLogin, existing } = input;
  const providerLabel = getProviderIntegrationDescriptor(provider).label;

  const facts = [
    line("Platform", providerLabel),
    line("Title", resource.name),
    line("Public URL", resource.url),
    line("Short description from the platform", resource.description),
    line("Created", resource.createdAt),
    line("Last updated", resource.updatedAt),
    line("Tags", resource.tags.slice(0, 20).join(", ")),
    line(
      "Metrics",
      resource.stats.map((stat) => `${stat.key}=${stat.value}`).join(", "),
    ),
    line("Author's handle on the platform", authorLogin),
  ].filter(Boolean) as string[];

  const longText = (resource.longText || "").slice(0, AI_README_CHAR_LIMIT);

  const alreadyFilled = (
    ["description", "projectRole", "problem", "solution", "results"] as const
  ).filter((field) => (existing[field] ?? "").trim().length > 0);

  const sections = [
    `A creator is publishing a project imported from ${providerLabel}. Draft the missing narrative fields from the facts below.`,
    "",
    "FACTS",
    facts.join("\n"),
  ];

  if (longText) {
    sections.push(
      "",
      `LONG-FORM TEXT FROM ${providerLabel.toUpperCase()} (the author's own words — use it as source material, never copy it verbatim)`,
      longText,
    );
  }

  if (alreadyFilled.length > 0) {
    sections.push(
      "",
      `The author already wrote these fields, so return an empty string for each of them: ${alreadyFilled.join(", ")}.`,
    );
  }

  sections.push(
    "",
    "Write only what the facts support. An empty string is a valid and expected answer for a field you cannot ground.",
  );

  return sections.join("\n");
}

export function normalizeSourceDraft(raw: {
  description?: string;
  projectRole?: string;
  problem?: string;
  solution?: string;
  results?: string;
}): SourceDraftFields {
  const cap = (value: string | undefined, limit: number): string => {
    const trimmed = (value ?? "").trim();
    return trimmed.length > limit ? trimmed.slice(0, limit - 1) + "…" : trimmed;
  };

  return {
    description: cap(raw.description, AI_SOURCE_DESCRIPTION_LIMIT),
    projectRole: cap(raw.projectRole, AI_PROJECT_FIELD_LIMITS.projectRole),
    problem: cap(raw.problem, AI_PROJECT_FIELD_LIMITS.problem),
    solution: cap(raw.solution, AI_PROJECT_FIELD_LIMITS.solution),
    results: cap(raw.results, AI_PROJECT_FIELD_LIMITS.results),
  };
}
