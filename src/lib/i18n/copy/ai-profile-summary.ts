export const aiProfileSummaryCopy = {
  en: {
    title: "AI profile summary",
    description:
      "A two-sentence elevator pitch displayed at the top of the public profile. Visitors can also (re)generate it from the profile page.",
    generate: "Generate",
    regenerate: "Regenerate",
    generating: "Generating…",
    clear: "Clear",
    emptyState:
      "No AI summary yet. Generate one to give visitors a quick read on who you are.",
    generatedAt: "Last generated",
    error: "Could not generate a summary. Please try again.",
    deleteError: "Could not clear the summary.",
    publicLabel: "AI-generated summary",
    publicGenerate: "Generate AI summary",
    publicEmpty:
      "No AI summary yet — generate a 2-sentence read on this person.",
    publicHint: "Powered by AI · regeneratable",
  },
  uk: {
    title: "AI-резюме профілю",
    description:
      "Двореченнєвий опис кандидата вгорі публічного профілю. Відвідувачі теж можуть (пере)згенерувати його прямо зі сторінки профілю.",
    generate: "Згенерувати",
    regenerate: "Згенерувати знову",
    generating: "Генеруємо…",
    clear: "Прибрати",
    emptyState:
      "AI-резюме ще не створено. Згенеруйте, щоб відвідувачі за 5 секунд зрозуміли, хто ви.",
    generatedAt: "Згенеровано",
    error: "Не вдалося згенерувати резюме. Спробуйте ще раз.",
    deleteError: "Не вдалося прибрати резюме.",
    publicLabel: "AI-згенероване резюме",
    publicGenerate: "Згенерувати AI-резюме",
    publicEmpty:
      "Поки що немає AI-резюме — згенеруйте короткий 2-реченнєвий опис цієї людини.",
    publicHint: "Створено AI · можна перегенерувати",
  },
} as const;
