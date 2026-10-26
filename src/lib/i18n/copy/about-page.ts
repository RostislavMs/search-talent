export const aboutPageCopy = {
  en: {
    title: "SearchTalent — the community where work gets seen",
    description:
      "A platform for IT and digital specialists — show your portfolio, publish projects and articles, and build a professional reputation.",
    heroPoints: ["Free to use", "Ukrainian and English"],
    heroIllustrationLabel:
      "Diagram: one profile feeding a project, an article, a leaderboard, and a rating mark",
    pillarsTitle: "What is inside",
    pillars: [
      {
        title: "A public profile",
        text: "One fast public page for skills, experience, education, and links — and a PDF résumé export. You can also mark what you're open to, so people can get in touch.",
        illustrationLabel:
          "A profile card with skill pills and a download arrow into a tray",
      },
      {
        title: "Portfolio and projects",
        text: "Real work with images, video, and tech stack. Every project gets its own page and its own score.",
        illustrationLabel: "A media frame with a play button and stack tags",
      },
      {
        title: "Community and content",
        text: "Articles, polls, and discussions in one Community hub.",
        illustrationLabel:
          "An open article spread with a poll chart and a speech bubble",
      },
      {
        title: "Reputation and rating",
        text: "A transparent rating built from community scores and badges, so strong work surfaces.",
        illustrationLabel: "A podium with a star medal above the top place",
      },
    ],
    stepsTitle: "How it works",
    stepsIllustrationLabel:
      "Diagram: three connected steps — create the profile, show your work, build a reputation",
    steps: [
      {
        title: "Create your profile",
        text: "Fill in who you are: skills, experience, and education.",
      },
      {
        title: "Show your work",
        text: "Publish projects, articles, and other professional content.",
      },
      {
        title: "Build your reputation",
        text: "Collect scores, engage with the community, and grow a professional profile.",
      },
    ],
    missionEyebrow: "Why this exists",
    // The lead ships in two pieces so the claim can sit in its own span and
    // pick up the marker sweep. Sentence-final punctuation belongs *inside*
    // the marked half — a highlighter does not stop short of the full stop,
    // and leaving it outside opens a visible gap after the marker's padding.
    // Keep the marked half to one line: `box-decoration-break: clone` sizes
    // the background per line box, so a phrase spanning three of them reads
    // mid-sweep as three separate highlights instead of one moving marker.
    missionLeadBefore:
      "Experience is easy to put into words. What is hard is showing your level so that ",
    missionLeadMark: "it reads at a glance.",
    missionText:
      "SearchTalent gives you one page where the profile, the real projects, the articles, and the community's response all sit side by side. Not a list of job titles — what you actually built, and how your peers answered it.",
    missionIllustrationLabel:
      "Diagram: scattered files, links, and screenshots converging into a single profile page",
    featuresTitle: "What you can do",
    features: [
      "A customizable public profile with a PDF résumé export",
      "Portfolio projects with images, video, and tech stacks",
      "Articles and polls, solo or with co-authors",
      "Community scores and badges earned through contribution",
      "Discovery through search, topic pages, and leaderboards",
      "Follows, reactions, and comments on every surface",
    ],
    communityTitle: "Reputation comes from the community",
    communityText:
      "A profile is more than a set of facts about you. Your work, your articles, and your activity show your real level, and the community's reactions and scores are what turn that into a professional reputation.",
    communityPrinciples: [
      {
        title: "So level shows, not volume",
        text: "A score lands on a specific piece of work, so a strong project counts for more than a well-written summary of yourself.",
      },
      {
        title: "So strong work finds readers",
        text: "The rating feeds search, topic pages, and the leaderboards — that is how people who have never heard of you end up on your profile.",
      },
      {
        title: "So it cannot be gamed",
        text: "One account, one vote — and an old win doesn't stay on top forever.",
      },
    ],
    communityIllustrationLabel:
      "Diagram: a closed loop between three people and the work they react to",
    ctaTitle: "Ready to show your work?",
    ctaText:
      "The profile is free, the first project takes about ten minutes, and after that the work speaks for itself.",
    ctaPrimary: "Create your profile",
    // Shown instead of `ctaPrimary` once the reader is signed in — inviting
    // someone with an account to "create a profile" reads as a dead end.
    ctaPrimaryAuthed: "Publish a project",
    ctaSecondary: "Explore specialists",
    backToHome: "Back to home",
  },
  uk: {
    title: "SearchTalent — спільнота, де роботу видно",
    description:
      "Платформа для IT- та digital-фахівців, де можна показувати портфоліо, публікувати проєкти й статті та будувати професійну репутацію.",
    heroPoints: ["Безкоштовно", "Українською та англійською"],
    heroIllustrationLabel:
      "Схема: один профіль живить проєкт, статтю, лідерборд і рейтингову позначку",
    pillarsTitle: "Що всередині",
    pillars: [
      {
        title: "Публічний профіль",
        text: "Одна швидка публічна сторінка з навичками, досвідом, освітою та посиланнями — і експорт у PDF-резюме. Можна позначити, до чого ви відкриті, щоб вам могли написати.",
        illustrationLabel:
          "Картка профілю з пілюлями навичок і стрілкою завантаження в лоток",
      },
      {
        title: "Портфоліо та проєкти",
        text: "Реальні роботи із зображеннями, відео та стеком. Кожен проєкт має власну сторінку й власну оцінку.",
        illustrationLabel: "Медіа-рамка з кнопкою відтворення та тегами стеку",
      },
      {
        title: "Спільнота та контент",
        text: "Статті, опитування й обговорення в одному розділі «Спільнота».",
        illustrationLabel:
          "Розкрита стаття з діаграмою опитування та бульбашкою коментаря",
      },
      {
        title: "Репутація та рейтинг",
        text: "Прозорий рейтинг з оцінок спільноти та відзнак, тож сильні роботи помітні.",
        illustrationLabel: "Подіум із зірковою медаллю над першим місцем",
      },
    ],
    stepsTitle: "Як це працює",
    stepsIllustrationLabel:
      "Схема: три пов'язані кроки — створити профіль, показати роботи, розвивати репутацію",
    steps: [
      {
        title: "Створіть профіль",
        text: "Заповніть інформацію про себе, навички, досвід та освіту.",
      },
      {
        title: "Покажіть свою роботу",
        text: "Публікуйте проєкти, статті та інший професійний контент.",
      },
      {
        title: "Розвивайте репутацію",
        text: "Отримуйте оцінки, взаємодійте зі спільнотою та формуйте професійний профіль.",
      },
    ],
    missionEyebrow: "Навіщо це",
    // Тримайте позначену половину в один рядок: `box-decoration-break: clone`
    // масштабує фон окремо для кожного рядка, тож фраза на три рядки в русі
    // читається як три різні підсвітки, а не один рух маркера.
    missionLeadBefore:
      "Досвід легко описати словами. Значно важче — показати рівень так, щоб ",
    missionLeadMark: "його було видно одразу.",
    missionText:
      "SearchTalent дає одну сторінку, де поруч стоять профіль, реальні проєкти, статті та реакція спільноти. Не перелік місць роботи, а те, що ви справді зробили — і як на це відповіли колеги.",
    missionIllustrationLabel:
      "Схема: розрізнені файли, посилання та скриншоти сходяться в одну сторінку профілю",
    featuresTitle: "Що ви можете робити",
    features: [
      "Кастомізований публічний профіль з експортом PDF-резюме",
      "Портфоліо-проєкти із зображеннями, відео та стеком технологій",
      "Статті й опитування — самостійно або у співавторстві",
      "Оцінки спільноти та відзнаки за реальний внесок",
      "Видимість через пошук, тематичні сторінки та лідерборди",
      "Підписки, реакції та коментарі на всіх розділах",
    ],
    communityTitle: "Репутація формується спільнотою",
    communityText:
      "Профіль — це не просто набір інформації про себе. Роботи, статті та активність показують ваш реальний рівень, а реакції та оцінки спільноти допомагають формувати професійну репутацію.",
    communityPrinciples: [
      {
        title: "Щоб було видно рівень, а не гучність",
        text: "Оцінка ставиться конкретній роботі, тож сильний проєкт важить більше, ніж гарно написаний текст про себе.",
      },
      {
        title: "Щоб сильні роботи знаходили читача",
        text: "Рейтинг живить пошук, тематичні сторінки й лідерборди — саме так на ваш профіль потрапляють люди, які про вас не чули.",
      },
      {
        title: "Щоб це не можна було накрутити",
        text: "Один акаунт — один голос, і стара перемога не сидить у топі вічно.",
      },
    ],
    communityIllustrationLabel:
      "Схема: замкнене коло між трьома людьми та роботою, на яку вони реагують",
    ctaTitle: "Готові показати свої роботи?",
    ctaText:
      "Профіль безкоштовний, перший проєкт займе хвилин десять, а далі все залежить від самої роботи.",
    ctaPrimary: "Створити профіль",
    // Показуємо замість `ctaPrimary`, коли читач уже авторизований —
    // пропозиція «створити профіль» людині з акаунтом веде в нікуди.
    ctaPrimaryAuthed: "Опублікувати проєкт",
    ctaSecondary: "Переглянути фахівців",
    backToHome: "На головну",
  },
} as const;
