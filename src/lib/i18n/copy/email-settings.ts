export const emailSettingsCopy = {
  en: {
    title: "Email settings",
    description:
      "Service emails (sign-in, codes, answers to applications) always arrive.",
    back: "Notifications",
    openLink: "Email settings",
    messagesTitle: "New messages",
    messagesHint: "Never with the text of a message.",
    messageModes: {
      instant: {
        label: "At once",
        hint: "If a message stays unread for 10 minutes.",
      },
      daily: {
        label: "Once a day",
        hint: "One email in the morning about the unread messages that came in since the day before.",
      },
      off: {
        label: "Never",
        hint: "Messages wait on the site.",
      },
    },
    followersTitle: "New followers",
    followersHint: "When someone follows you.",
    jobAlertsTitle: "Job alerts",
    jobAlertsHint: "Each saved search has its own email switch.",
    jobAlertsLink: "Manage job alerts",
    saved: "Saved",
    failed: "Couldn't save. Try again.",
    meta: {
      title: "Email settings",
      description: "Which emails SearchTalent sends you.",
    },
  },
  uk: {
    title: "Налаштування листів",
    description:
      "Службові листи (вхід, коди, відповіді на відгуки) приходять завжди.",
    back: "Сповіщення",
    openLink: "Налаштування листів",
    messagesTitle: "Нові повідомлення",
    messagesHint: "Ніколи з текстом повідомлення.",
    messageModes: {
      instant: {
        label: "Одразу",
        hint: "Якщо повідомлення 10 хвилин лишається непрочитаним.",
      },
      daily: {
        label: "Раз на день",
        hint: "Один лист уранці про непрочитані повідомлення, що прийшли з учорашнього дня.",
      },
      off: {
        label: "Не надсилати",
        hint: "Повідомлення чекатимуть на сайті.",
      },
    },
    followersTitle: "Нові підписники",
    followersHint: "Коли хтось підписується на вас.",
    jobAlertsTitle: "Підписки на вакансії",
    jobAlertsHint: "У кожного збереженого пошуку свій перемикач листів.",
    jobAlertsLink: "Керувати підписками",
    saved: "Збережено",
    failed: "Не вдалося зберегти. Спробуйте ще раз.",
    meta: {
      title: "Налаштування листів",
      description: "Які листи надсилає SearchTalent.",
    },
  },
} as const;
