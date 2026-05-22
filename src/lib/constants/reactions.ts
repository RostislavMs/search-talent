/**
 * Canonical reaction emoji set, shared between the database CHECK
 * constraint (validated at write time via zod) and the picker UI.
 *
 * Keep the tuple narrow and stable: adding new emoji is safe, removing
 * one would orphan historical rows.
 */
export const REACTION_EMOJIS = [
  "\u{1F44D}", // 👍 thumbs up
  "❤️", // ❤️ red heart
  "\u{1F525}", // 🔥 fire
  "\u{1F4A1}", // 💡 light bulb
  "\u{1F602}", // 😂 face with tears of joy
  "\u{1F62E}", // 😮 face with open mouth
  "\u{1F389}", // 🎉 party popper
  "\u{1F44F}", // 👏 clapping hands
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const REACTION_TARGET_TYPES = [
  "project_comment",
  "article_comment",
  "article",
] as const;

export type ReactionTargetType = (typeof REACTION_TARGET_TYPES)[number];

export type ReactionSummary = {
  emoji: ReactionEmoji;
  count: number;
  reactedByMe: boolean;
};

export type ReactionsByTarget = Record<string, ReactionSummary[]>;
