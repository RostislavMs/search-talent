/**
 * AI feature catalog. Keep this list in sync with the
 * `ai_usage_feature_check` CHECK constraint in the database.
 */
export const AI_FEATURES = ["github_draft", "profile_summary"] as const;

/**
 * AI-summary on the public profile page: a 2-sentence elevator pitch.
 * Conservative limit keeps it tight enough to render on profile cards.
 */
export const AI_PROFILE_SUMMARY_CHAR_LIMIT = 320;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_PROVIDERS = ["gemini"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * Default model used for narrative-drafting tasks. Free tier on Google
 * AI Studio (1500 requests/day as of 2026). Override via env if you
 * upgrade to a paid model.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Per-user rate limit for AI features: max requests inside the window.
 * Tuned to fit comfortably within the Gemini free-tier daily allowance
 * even with many active users.
 */
export const AI_PER_USER_LIMIT = 10;
export const AI_PER_USER_WINDOW_MS = 60 * 60 * 1000;

/**
 * Hard cap on README characters we ship to the model. README rarely
 * carries signal past the first ~10k chars and we want to keep token
 * costs predictable.
 */
export const AI_README_CHAR_LIMIT = 10_000;

/**
 * Soft caps on the AI-generated drafts for the standard project
 * narrative fields. Match the column-level validation limits in
 * `src/lib/validation/project.ts` so the AI output is always
 * accepted by the form's own validator.
 */
export const AI_PROJECT_FIELD_LIMITS = {
  projectRole: 160,
  problem: 5000,
  solution: 5000,
  results: 5000,
} as const;

/**
 * Pricing per 1M tokens for usage tracking. Costs are recorded even on
 * the free tier so we have a meaningful "what would this have cost"
 * number when we look at usage analytics.
 */
export const GEMINI_PRICING_USD_PER_M = {
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
} as const;
