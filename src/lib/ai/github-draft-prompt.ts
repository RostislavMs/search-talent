import {
  GITHUB_FIELD_LIMITS,
  GITHUB_PROJECT_ROLES,
  type GithubProjectRole,
  type GithubRepoDetail,
} from "@/lib/constants/github";
import {
  AI_PROJECT_FIELD_LIMITS,
  AI_README_CHAR_LIMIT,
} from "@/lib/constants/ai";

/**
 * Pure prompt construction. Lives in its own module (no `server-only`
 * import) so it can be unit-tested without spinning up the Gemini SDK.
 */

export type GithubDraftFields = {
  // GitHub-specific narrative (Step 2)
  role: GithubProjectRole | null;
  contribution: string;
  motivation: string;
  techDecisions: string;
  learnings: string;
  showcaseNotes: string;
  productionUsage: string;
  // Standard project narrative (Steps 1 + 3)
  projectRole: string;
  problem: string;
  solution: string;
  results: string;
};

export type GithubDraftPromptInput = {
  repo: GithubRepoDetail;
  authorLogin: string | null;
  locale: "uk" | "en";
  existing: Partial<GithubDraftFields>;
};

export function buildGithubDraftSystemInstruction(
  locale: "uk" | "en",
): string {
  const langLine =
    locale === "uk"
      ? "Reply in Ukrainian (українською мовою)."
      : "Reply in English.";

  return [
    "You help open-source authors describe their work on a talent-discovery platform called SearchTalent.",
    "Your output drafts narrative fields for a public project page that peers and the community will read.",
    "Write in first person from the AUTHOR's perspective ('I built…', 'I chose…').",
    "Be concrete and specific. Avoid hype, buzzwords, and generic phrasing like 'cutting-edge' or 'leveraged'.",
    "If a piece of information is not supported by the input, return an empty string rather than guessing.",
    "Never invent stars, contributors, dates, or production usage that aren't in the input.",
    langLine,
  ].join(" ");
}

export function buildGithubDraftPrompt(input: GithubDraftPromptInput): string {
  const { repo, authorLogin, existing } = input;
  const readme = (repo.readme || "").slice(0, AI_README_CHAR_LIMIT);

  const topLanguages = repo.languageBreakdown
    .slice(0, 5)
    .map((entry) => `${entry.name} (${entry.percent}%)`)
    .join(", ");

  const releaseLine = repo.latestRelease
    ? `${repo.latestRelease.tagName} (${repo.latestRelease.publishedAt ?? "unknown date"})`
    : "no releases";

  const existingNotes: string[] = [];
  if (existing.role) existingNotes.push(`- role: ${existing.role}`);
  if (existing.contribution)
    existingNotes.push(`- contribution: ${existing.contribution}`);
  if (existing.motivation)
    existingNotes.push(`- motivation: ${existing.motivation}`);
  if (existing.techDecisions)
    existingNotes.push(`- techDecisions: ${existing.techDecisions}`);
  if (existing.learnings)
    existingNotes.push(`- learnings: ${existing.learnings}`);
  if (existing.showcaseNotes)
    existingNotes.push(`- showcaseNotes: ${existing.showcaseNotes}`);
  if (existing.productionUsage)
    existingNotes.push(`- productionUsage: ${existing.productionUsage}`);
  if (existing.projectRole)
    existingNotes.push(`- projectRole: ${existing.projectRole}`);
  if (existing.problem) existingNotes.push(`- problem: ${existing.problem}`);
  if (existing.solution)
    existingNotes.push(`- solution: ${existing.solution}`);
  if (existing.results) existingNotes.push(`- results: ${existing.results}`);

  const existingBlock =
    existingNotes.length > 0
      ? [
          "",
          "FIELDS THE AUTHOR ALREADY WROTE (re-use the same voice; you may refine but do not contradict):",
          ...existingNotes,
        ].join("\n")
      : "";

  return [
    `Author's GitHub handle: ${authorLogin || "unknown"}`,
    `Repository: ${repo.fullName}`,
    `Short description: ${repo.description || "(none)"}`,
    `Homepage: ${repo.homepage || "(none)"}`,
    `License: ${repo.license?.spdxId || repo.license?.name || "none"}`,
    `Created: ${repo.createdAt ?? "unknown"}`,
    `Last commit: ${repo.pushedAt ?? "unknown"}`,
    `Latest release: ${releaseLine}`,
    `Stars: ${repo.stargazersCount} · Forks: ${repo.forksCount} · Contributors: ${repo.contributorsCount}`,
    `Top languages: ${topLanguages || "n/a"}`,
    `Topics: ${repo.topics.join(", ") || "n/a"}`,
    `Archived: ${repo.isArchived ? "yes" : "no"} · Fork: ${repo.isFork ? "yes" : "no"}`,
    "",
    "README:",
    readme || "(no README content)",
    existingBlock,
    "",
    "Draft each requested field. Stay within these character budgets:",
    `- contribution: <= ${GITHUB_FIELD_LIMITS.contribution} chars`,
    `- motivation: <= ${GITHUB_FIELD_LIMITS.motivation} chars`,
    `- techDecisions: <= ${GITHUB_FIELD_LIMITS.techDecisions} chars`,
    `- learnings: <= ${GITHUB_FIELD_LIMITS.learnings} chars`,
    `- showcaseNotes: <= ${GITHUB_FIELD_LIMITS.showcaseNotes} chars`,
    `- productionUsage: <= ${GITHUB_FIELD_LIMITS.productionUsage} chars`,
    `- projectRole: <= ${AI_PROJECT_FIELD_LIMITS.projectRole} chars (a short job-title-style label, e.g. "Lead full-stack engineer")`,
    `- problem: <= ${AI_PROJECT_FIELD_LIMITS.problem} chars (what real-world problem this project addresses, 1-3 paragraphs)`,
    `- solution: <= ${AI_PROJECT_FIELD_LIMITS.solution} chars (the author's narrative of how the project solves it, NOT a verbatim README dump, 1-3 paragraphs)`,
    `- results: <= ${AI_PROJECT_FIELD_LIMITS.results} chars (concrete outcomes, metrics, who benefits; empty string if no signal in the input)`,
  ].join("\n");
}

/** Normalizes raw model output into our DB-friendly shape. */
export function normalizeGithubDraft(raw: {
  role?: string;
  contribution?: string;
  motivation?: string;
  techDecisions?: string;
  learnings?: string;
  showcaseNotes?: string;
  productionUsage?: string;
  projectRole?: string;
  problem?: string;
  solution?: string;
  results?: string;
}): GithubDraftFields {
  const role =
    raw.role && GITHUB_PROJECT_ROLES.includes(raw.role as GithubProjectRole)
      ? (raw.role as GithubProjectRole)
      : null;

  const cap = (value: string | undefined, limit: number): string => {
    const trimmed = (value ?? "").trim();
    return trimmed.length > limit ? trimmed.slice(0, limit - 1) + "…" : trimmed;
  };

  return {
    role,
    contribution: cap(raw.contribution, GITHUB_FIELD_LIMITS.contribution),
    motivation: cap(raw.motivation, GITHUB_FIELD_LIMITS.motivation),
    techDecisions: cap(raw.techDecisions, GITHUB_FIELD_LIMITS.techDecisions),
    learnings: cap(raw.learnings, GITHUB_FIELD_LIMITS.learnings),
    showcaseNotes: cap(raw.showcaseNotes, GITHUB_FIELD_LIMITS.showcaseNotes),
    productionUsage: cap(
      raw.productionUsage,
      GITHUB_FIELD_LIMITS.productionUsage,
    ),
    projectRole: cap(raw.projectRole, AI_PROJECT_FIELD_LIMITS.projectRole),
    problem: cap(raw.problem, AI_PROJECT_FIELD_LIMITS.problem),
    solution: cap(raw.solution, AI_PROJECT_FIELD_LIMITS.solution),
    results: cap(raw.results, AI_PROJECT_FIELD_LIMITS.results),
  };
}
