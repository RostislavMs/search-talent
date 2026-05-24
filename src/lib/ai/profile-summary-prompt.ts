import { AI_PROFILE_SUMMARY_CHAR_LIMIT } from "@/lib/constants/ai";

/**
 * Inputs that feed the AI-summary prompt. Kept loose: the profile/
 * projects/articles loaders return different rows depending on
 * context; the prompt builder only reads the fields it actually needs.
 */
export type ProfileSummaryInput = {
  locale: "uk" | "en";
  /** Identity / headline */
  name: string | null;
  username: string | null;
  headline: string | null;
  /** Long-form bio the user has already written. */
  bio: string | null;
  /** Free-form "tell us more" / preferences text. */
  additionalInfo: string | null;
  /** Experience signal. */
  experienceLevel: string | null;
  experienceYears: number | null;
  /** Skill names the user has selected on their profile. */
  skills: string[];
  /** Recent projects (title + 1-line description + tech list). */
  projects: Array<{
    title: string;
    description: string | null;
    techStack: string[];
  }>;
  /** Recent articles (title + 1-line excerpt). */
  articles: Array<{
    title: string;
    excerpt: string | null;
  }>;
};

export function buildProfileSummarySystemInstruction(
  locale: "uk" | "en",
): string {
  const langLine =
    locale === "uk"
      ? "Reply in Ukrainian (українською мовою)."
      : "Reply in English.";

  return [
    "You write 2-sentence professional summaries for SearchTalent profiles.",
    "Output is shown at the top of a public profile so recruiters can grasp the candidate in 5 seconds.",
    "Sentence 1: who they are professionally (role + experience level + key strengths).",
    "Sentence 2: what they have shipped or are best at, grounded in their projects/articles when possible.",
    "Speak about the person in third person ('Alice builds…', 'They focus on…').",
    "Avoid generic phrases ('passionate', 'innovative', 'cutting-edge', 'leveraged').",
    "Never invent companies, metrics, employers, or credentials that aren't in the input.",
    `Hard limit: <= ${AI_PROFILE_SUMMARY_CHAR_LIMIT} characters including spaces. Two sentences total.`,
    langLine,
  ].join(" ");
}

export function buildProfileSummaryPrompt(input: ProfileSummaryInput): string {
  const displayName =
    input.name?.trim() || input.username?.trim() || "the candidate";

  const projectsBlock = input.projects.length
    ? input.projects
        .slice(0, 6)
        .map((project, idx) => {
          const techPart = project.techStack.length
            ? ` [${project.techStack.slice(0, 6).join(", ")}]`
            : "";
          const descPart = project.description?.trim()
            ? ` — ${project.description.trim().slice(0, 200)}`
            : "";
          return `${idx + 1}. ${project.title}${techPart}${descPart}`;
        })
        .join("\n")
    : "(no projects yet)";

  const articlesBlock = input.articles.length
    ? input.articles
        .slice(0, 5)
        .map((article, idx) => {
          const excerptPart = article.excerpt?.trim()
            ? ` — ${article.excerpt.trim().slice(0, 160)}`
            : "";
          return `${idx + 1}. ${article.title}${excerptPart}`;
        })
        .join("\n")
    : "(no articles yet)";

  return [
    `Display name: ${displayName}`,
    `Username: @${input.username || "—"}`,
    `Headline: ${input.headline || "(none)"}`,
    `Bio: ${input.bio || "(none)"}`,
    input.additionalInfo
      ? `Additional notes: ${input.additionalInfo}`
      : null,
    `Experience: ${input.experienceLevel || "—"}${
      input.experienceYears ? ` (${input.experienceYears} yrs)` : ""
    }`,
    `Skills: ${input.skills.length ? input.skills.join(", ") : "—"}`,
    "",
    "Recent projects:",
    projectsBlock,
    "",
    "Recent articles:",
    articlesBlock,
    "",
    "Write the 2-sentence summary now.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/**
 * Defensive trimming/cap. Gemini sometimes returns extra whitespace or
 * sneaks past the requested length; this normalises to a single line.
 */
export function normalizeProfileSummary(raw: string | null | undefined): string {
  if (!raw) return "";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length <= AI_PROFILE_SUMMARY_CHAR_LIMIT) return collapsed;
  return collapsed.slice(0, AI_PROFILE_SUMMARY_CHAR_LIMIT - 1) + "…";
}
