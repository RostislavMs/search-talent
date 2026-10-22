export const aiDraftCopy = {
  en: {
    title: "AI draft",
    button: "Generate with AI",
    generating: "Generating…",
    applied: "AI filled {count} field(s). Check them — AI can be wrong.",
    appliedPartial:
      "AI filled {count} field(s) and left the rest empty — the source says too little about them. Check what it wrote: AI can be wrong.",
    noSignal:
      "The source says too little — AI had nothing to suggest. Add a README or a description and try again.",
    allFilled: "All fields are already filled — nothing to draft.",
    error: "Could not generate a draft. Please try again.",
  },
  uk: {
    title: "Чернетка з ШІ",
    button: "Згенерувати",
    generating: "Генеруємо…",
    applied: "ШІ заповнив полів: {count}. Перевірте їх — ШІ може помилятися.",
    appliedPartial:
      "ШІ заповнив полів: {count}, а решту лишив порожніми — для них у джерелі замало даних. Перевірте заповнене: ШІ може помилятися.",
    noSignal:
      "У джерелі замало даних — ШІ нічого не запропонував. Допишіть README чи опис і спробуйте ще раз.",
    allFilled: "Усі поля вже заповнені — нема чого генерувати.",
    error: "Не вдалося згенерувати чернетку. Спробуйте ще раз.",
  },
} as const;
