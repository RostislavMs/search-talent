export const aiDraftCopy = {
  en: {
    title: "AI draft",
    description:
      "Let AI suggest drafts for the empty fields above (incl. role, problem, solution, results). You can edit anything afterwards.",
    button: "Generate with AI",
    generating: "Generating…",
    applied: "AI filled {count} field(s). You can edit them.",
    allFilled: "All fields are already filled — nothing to draft.",
    error: "Could not generate a draft. Please try again.",
  },
  uk: {
    title: "AI чернетка",
    description:
      "AI пропонує draft-варіанти для порожніх полів (включно з роллю, problem, solution, results). Усе можна відредагувати.",
    button: "Згенерувати з AI",
    generating: "Генеруємо…",
    applied: "AI заповнив {count} пол(е/ів). Ви можете їх редагувати.",
    allFilled: "Усі поля вже заповнені — нема для чого генерувати.",
    error: "Не вдалося згенерувати draft. Спробуйте ще раз.",
  },
} as const;
