import type { Locale } from "@/lib/i18n/config";

export type MarketingFaqItem = {
  question: string;
  answer: string;
};

const marketingContent = {
  en: {
    home: {
      whyTitle: "Why portfolios beat resumes",
      whyBullets: [
        "Portfolios show how people solve real problems, not just which tools they list.",
        "Visitors can review code samples, design decisions, and shipped outcomes in context.",
        "Real project evidence makes discovery faster and reduces guesswork before opening a profile.",
      ],
      browseByRoleTitle: "Browse by role",
      browseByRoleDescription:
        "Start with the role you need and jump straight into public portfolios with live project context.",
      featuredTalentsTitle: "Featured talents",
      featuredTalentsDescription:
        "A curated set of standout profiles with real work, clear positioning, and public portfolios.",
      latestArticlesTitle: "Latest articles",
      latestArticlesDescription:
        "Fresh technical writing, portfolio advice, and community insights from the SearchTalent network.",
      howItWorksTitle: "How it works",
      talentTrackTitle: "For creators",
      explorerTrackTitle: "For explorers",
      talentSteps: [
        {
          title: "Build a public profile",
          description:
            "Add your role, skills, work preferences, and the context that makes your craft visible.",
        },
        {
          title: "Publish real projects",
          description:
            "Show shipped work with stack details, screenshots, repositories, and outcomes.",
        },
        {
          title: "Get discovered by proof",
          description:
            "Appear in role, technology, and portfolio discovery flows built around real project evidence.",
        },
      ],
      explorerSteps: [
        {
          title: "Browse by role and stack",
          description:
            "Start from the topic you care about and narrow the list using real portfolio context.",
        },
        {
          title: "Review projects and articles",
          description:
            "Compare delivered work, technology choices, and writing — everything in one public space.",
        },
        {
          title: "Follow and engage",
          description:
            "Follow creators whose work resonates, leave reactions, and start conversations around their projects.",
        },
      ],
      faqTitle: "FAQ",
      faq: [
        {
          question: "What makes SearchTalent different from a resume database?",
          answer:
            "SearchTalent focuses on public project portfolios. Instead of scanning job titles alone, visitors can review real work, technology stacks, and delivery details before contacting a specialist.",
        },
        {
          question: "Who can create a profile on SearchTalent?",
          answer:
            "Developers, designers, QA engineers, product specialists, analysts, DevOps engineers, and other IT professionals can create a public profile and publish project portfolios.",
        },
        {
          question: "Can visitors browse without creating an account?",
          answer:
            "Yes. Public portfolios, project pages, and articles are browseable without logging in, so anyone can explore work before deciding to join.",
        },
        {
          question: "What should a strong portfolio include?",
          answer:
            "The strongest portfolios include clear project descriptions, screenshots or media, technology stacks, the specialist's role, and outcomes or metrics where possible.",
        },
        {
          question: "Are portfolios filtered by role and technology?",
          answer:
            "Yes. Visitors can explore talent by category, review projects by stack, and use discovery filters to narrow results to the most relevant specialists.",
        },
        {
          question: "Can SearchTalent help me grow personal brand?",
          answer:
            "Yes. Public project pages and technical articles let you document how you think, what you build, and how you communicate — that becomes the surface people remember you by.",
        },
      ] satisfies MarketingFaqItem[],
      footerCtaTitle: "Build a portfolio that proves what you can do",
      footerCtaDescription:
        "Create a public SearchTalent profile, publish your real projects, and let your work speak for itself in front of a community that values craft.",
    },
    talents: {
      title: "Discover IT Talents with Real Project Portfolios",
      intro: [
        "SearchTalent helps the community discover IT talents through real project portfolios instead of relying only on resumes. Public profiles show how specialists present their work, which technologies they use, and what kinds of products they have built. That means a stronger first signal before any outreach begins.",
        "On this page you can browse developers, designers, QA engineers, DevOps specialists, analysts, product people, and other IT professionals who publish public project evidence. Each profile is connected to actual work samples, technology stacks, and portfolio context — so it is easier to understand a creator's craft, scope of work, and the environments they have shipped inside.",
        "For visitors, that makes discovery more practical. Instead of filtering by buzzwords alone, you can compare role fit, project depth, tools, and visible outcomes in one place. For specialists, it creates a better surface for being recognised by what they have built. SearchTalent is designed to make talent discovery more transparent, more skill-based, and more useful for everyone in the community.",
      ],
      popularCategoriesTitle: "Popular categories",
      popularCategoriesDescription:
        "Explore talent directories built around the most active portfolio roles on the platform.",
      popularTechnologiesTitle: "Popular technologies",
      popularTechnologiesDescription:
        "These are the stacks and tools that appear most often across public profiles and projects.",
      featuredTalentsTitle: "Featured talents",
      featuredTalentsDescription:
        "Profiles with strong public work, clear positioning, and visible project proof.",
      faqTitle: "Talent search FAQ",
      faq: [
        {
          question: "What can I evaluate on a SearchTalent profile?",
          answer:
            "You can review a specialist's role, skills, technology stack, portfolio projects, work preferences, and public profile information before contacting them.",
        },
        {
          question: "Does SearchTalent support browsing by role?",
          answer:
            "Yes. Talent directories can be explored by role and filtered further by technologies, location, experience, and work format.",
        },
        {
          question: "Why are public portfolios useful?",
          answer:
            "Portfolios reveal execution details that resumes rarely show, including project scope, stack choices, media, and practical examples of delivered work.",
        },
        {
          question: "Can I compare specialists with similar stacks?",
          answer:
            "Yes. Technology filters and public project metadata make it easier to compare specialists working with similar tools or delivery environments.",
        },
        {
          question: "Who are these profiles for?",
          answer:
            "SearchTalent is focused on IT and digital product creators — engineering, design, QA, analytics, DevOps, and product-related roles — who want a public space to share their work.",
        },
      ] satisfies MarketingFaqItem[],
    },
    projects: {
      title: "Real IT Project Portfolios",
      intro: [
        "SearchTalent collects real IT project portfolios in one public catalog so visitors can explore how specialists describe their work, present technical decisions, and document delivered outcomes. Instead of browsing generic case-study fragments, you can open project pages with screenshots, technology stacks, role context, and links that make the work easier to evaluate.",
        "This project directory is useful for several audiences. Visitors can see how a creator has shipped work in a category or stack they care about. Other creators can research how peers structure portfolio presentations. Writers and technical readers can use project pages as entry points into public profiles and related articles published on the platform.",
        "Because each project is connected to a real creator profile, the catalog becomes more than a gallery. It helps visitors move from a single project to the person behind it, compare related work, and understand the broader context around delivery. SearchTalent uses project portfolios as a practical discovery layer for community connections, portfolio inspiration, and skill-based exploration.",
      ],
      faqTitle: "Project portfolio FAQ",
      faq: [
        {
          question: "What is included in a SearchTalent project portfolio?",
          answer:
            "Project pages can include descriptions, screenshots or media, technology stacks, links, the specialist's role, and additional problem-solution context.",
        },
        {
          question: "Why browse projects before opening a profile?",
          answer:
            "Projects provide a faster signal of execution quality. They show what was built and how it was presented before you dive deeper into the full profile.",
        },
        {
          question: "Can project portfolios help me find peers?",
          answer:
            "Yes. They make it easier to compare relevant work samples, understand stack familiarity, and find creators who have explored similar problems or technologies.",
        },
        {
          question: "Do project pages show the technology stack?",
          answer:
            "Yes. SearchTalent project pages highlight technologies and related implementation context whenever creators provide that information.",
        },
        {
          question: "Are projects connected to public specialist profiles?",
          answer:
            "Yes. Each public project can lead visitors to the creator profile, making it easier to review more work and understand the broader portfolio.",
        },
      ] satisfies MarketingFaqItem[],
    },
  },
  uk: {
    home: {
      whyTitle: "Чому портфоліо сильніше за резюме",
      whyBullets: [
        "Портфоліо показує, як автор вирішує реальні задачі, а не лише перелік інструментів.",
        "Спільнота бачить код, дизайн-рішення, стек і результати в реальному контексті.",
        "Реальні проєкти дають сильніший сигнал ще до того, як ти відкриєш профіль повністю.",
      ],
      browseByRoleTitle: "Перегляд за ролями",
      browseByRoleDescription:
        "Почніть з потрібної ролі та одразу переходьте до публічних портфоліо з реальними проєктами.",
      featuredTalentsTitle: "Рекомендовані таланти",
      featuredTalentsDescription:
        "Добірка сильних профілів з реальними роботами, чітким позиціонуванням і публічними кейсами.",
      latestArticlesTitle: "Останні статті",
      latestArticlesDescription:
        "Свіжі технічні матеріали, поради щодо портфоліо та інсайти спільноти SearchTalent.",
      howItWorksTitle: "Як це працює",
      talentTrackTitle: "Для авторів",
      explorerTrackTitle: "Для глядачів",
      talentSteps: [
        {
          title: "Створіть публічний профіль",
          description:
            "Додайте роль, навички, формат роботи та контекст, який робить ваше ремесло видимим.",
        },
        {
          title: "Опублікуйте реальні проєкти",
          description:
            "Покажіть виконані роботи зі стеком, скриншотами, репозиторіями та результатами.",
        },
        {
          title: "Ставайте видимими завдяки доказам",
          description:
            "Потрапляйте у пошук за ролями, технологіями та портфоліо на основі реальних кейсів.",
        },
      ],
      explorerSteps: [
        {
          title: "Шукайте за ролями та стеком",
          description:
            "Починайте з теми, яка вас цікавить, і звужуйте список за реальним контекстом портфоліо.",
        },
        {
          title: "Переглядайте проєкти та статті",
          description:
            "Порівнюйте виконані роботи, технологічні рішення та публікації — усе в одному просторі.",
        },
        {
          title: "Підписуйтесь і взаємодійте",
          description:
            "Підписуйтесь на авторів, чия робота резонує, лишайте реакції та починайте розмови біля їхніх проєктів.",
        },
      ],
      faqTitle: "FAQ",
      faq: [
        {
          question: "Чим SearchTalent відрізняється від бази резюме?",
          answer:
            "SearchTalent робить акцент на публічних портфоліо проєктів. Замість перегляду лише назв посад ви бачите реальні роботи, стек технологій і деталі реалізації до першого контакту.",
        },
        {
          question: "Хто може створити профіль на SearchTalent?",
          answer:
            "Профілі можуть створювати розробники, дизайнери, QA-фахівці, DevOps-інженери, аналітики, product-спеціалісти та інші IT-фахівці.",
        },
        {
          question: "Чи можна переглядати портфоліо без акаунта?",
          answer:
            "Так. Публічні профілі, сторінки проєктів і статті доступні для перегляду без входу, тому оцінити роботи можна ще до реєстрації.",
        },
        {
          question: "Що має бути в сильному портфоліо?",
          answer:
            "Найкраще працюють портфоліо з чітким описом проєкту, медіа, стеком технологій, роллю фахівця та результатами або метриками, якщо вони доступні.",
        },
        {
          question: "Чи можна шукати портфоліо за ролями й технологіями?",
          answer:
            "Так. На платформі можна переглядати таланти за категоріями, досліджувати проєкти за стеком і використовувати discovery-фільтри для точнішого пошуку.",
        },
        {
          question: "Чи допоможе SearchTalent з особистим брендом?",
          answer:
            "Так. Публічні проєкти й технічні статті дозволяють зафіксувати, як ви мислите, що створюєте та як комунікуєте — це і стає поверхнею, за якою вас запам'ятовують.",
        },
      ] satisfies MarketingFaqItem[],
      footerCtaTitle: "Створіть портфоліо, яке доводить ваш рівень",
      footerCtaDescription:
        "Створіть публічний профіль у SearchTalent, опублікуйте реальні проєкти й дайте своїй роботі говорити за вас у спільноті, що цінує ремесло.",
    },
    talents: {
      title: "Відкривайте IT-фахівців з реальними портфоліо",
      intro: [
        "SearchTalent допомагає спільноті знаходити IT-фахівців через реальні портфоліо проєктів, а не лише через резюме. Публічні профілі показують, як спеціаліст презентує свою роботу, якими технологіями користується та над якими продуктами вже працював. Це дає сильніший перший сигнал ще до того, як ти напишеш людині.",
        "На цій сторінці можна переглядати розробників, дизайнерів, QA-інженерів, DevOps-фахівців, аналітиків, product-спеціалістів та інших IT-професіоналів, які публікують свої кейси у відкритому доступі. Кожен профіль пов'язаний з реальними проєктами, стеком технологій і контекстом роботи, тому легше зрозуміти ремесло автора та середовища, в яких він працював.",
        "Для відвідувачів це означає практичніший пошук. Замість відбору лише за ключовими словами можна порівнювати релевантність ролі, глибину проєктів, інструменти та видимі результати в одному місці. Для самих авторів це краща модель видимості, де їх знаходять за тим, що вони реально зробили. SearchTalent створений для більш прозорого, навичкоорієнтованого пошуку талантів у спільноті.",
      ],
      popularCategoriesTitle: "Популярні категорії",
      popularCategoriesDescription:
        "Переглядайте найактивніші ролі з публічними профілями та портфоліо на платформі.",
      popularTechnologiesTitle: "Популярні технології",
      popularTechnologiesDescription:
        "Ці інструменти та стеки найчастіше зустрічаються у профілях і проєктах SearchTalent.",
      featuredTalentsTitle: "Рекомендовані таланти",
      featuredTalentsDescription:
        "Профілі з сильними кейсами, зрозумілим позиціонуванням і видимими доказами роботи.",
      faqTitle: "FAQ про пошук талантів",
      faq: [
        {
          question: "Що можна оцінити в профілі SearchTalent?",
          answer:
            "У профілі можна переглянути роль фахівця, навички, стек технологій, проєкти, формат роботи та іншу публічну інформацію до першого контакту.",
        },
        {
          question: "Чи підтримує SearchTalent перегляд за ролями?",
          answer:
            "Так. Каталоги талантів можна відкривати за ролями, а далі звужувати результати за технологіями, локацією, досвідом і форматом роботи.",
        },
        {
          question: "Чому публічні портфоліо корисні?",
          answer:
            "Портфоліо показують деталі виконання, яких часто немає в резюме: масштаб задач, стек, медіа, контекст і приклади реально доставленої роботи.",
        },
        {
          question: "Чи можна порівнювати спеціалістів зі схожим стеком?",
          answer:
            "Так. Фільтри за технологіями та metadata у проєктах допомагають швидше порівнювати фахівців зі схожим досвідом та інструментами.",
        },
        {
          question: "Для кого ці профілі?",
          answer:
            "Платформа сфокусована на IT і digital product авторах — engineering, design, QA, analytics, DevOps та product-напрямах — які хочуть мати публічний простір для своїх робіт.",
        },
      ] satisfies MarketingFaqItem[],
    },
    projects: {
      title: "Реальні IT-проєкти",
      intro: [
        "SearchTalent збирає реальні IT-проєкти в одному публічному каталозі, щоб відвідувачі могли переглядати, як автори описують свою роботу, презентують технічні рішення та документують результати. Замість фрагментарних кейсів ви отримуєте сторінки проєктів зі скриншотами, стеком технологій, роллю виконавця та посиланнями, які допомагають оцінити роботу глибше.",
        "Цей каталог корисний для кількох аудиторій. Відвідувачі можуть швидко побачити, як автор працював із певним типом продукту або стеком. Інші автори можуть досліджувати, як колеги оформлюють портфоліо. А технічні читачі можуть використовувати сторінки проєктів як точку входу до публічних профілів і пов'язаних статей.",
        "Оскільки кожен проєкт прив'язаний до реального профілю автора, каталог стає не просто галереєю. Він допомагає перейти від окремого кейсу до людини, яка його реалізувала, порівняти суміжні роботи й краще зрозуміти контекст виконання. SearchTalent використовує портфоліо проєктів як практичний шар discovery для спільнотних знайомств, натхнення та дослідження навичок за реальними роботами.",
      ],
      faqTitle: "FAQ про портфоліо проєктів",
      faq: [
        {
          question: "Що входить до портфоліо проєкту на SearchTalent?",
          answer:
            "Сторінка проєкту може містити опис, скриншоти або інші медіа, стек технологій, посилання, роль фахівця та додатковий контекст проблеми, рішення й результату.",
        },
        {
          question: "Навіщо переглядати проєкти перед відкриттям профілю?",
          answer:
            "Проєкти дають швидший сигнал про якість виконання. Вони показують, що саме було створено і як ця робота подана, ще до переходу в повний профіль.",
        },
        {
          question: "Чи допомагають портфоліо проєктів знаходити однодумців?",
          answer:
            "Так. Вони полегшують порівняння релевантних кейсів, допомагають зрозуміти знайомство зі стеком і швидше знаходити авторів зі схожим досвідом і колом задач.",
        },
        {
          question: "Чи видно на сторінках проєктів стек технологій?",
          answer:
            "Так. SearchTalent підсвічує використані технології та пов'язаний технічний контекст, якщо автор його вказав.",
        },
        {
          question: "Чи пов'язані проєкти з публічними профілями спеціалістів?",
          answer:
            "Так. Із публічного проєкту можна перейти до профілю автора, щоб переглянути інші роботи й ширший контекст портфоліо.",
        },
      ] satisfies MarketingFaqItem[],
    },
  },
} as const;

export function getMarketingContent(locale: Locale) {
  return marketingContent[locale];
}

export function slugifySegment(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "item"
  );
}

export function getTalentRoleIntro(locale: Locale, role: string) {
  if (locale === "uk") {
    return [
      `Переглядайте портфоліо фахівців у категорії ${role} на SearchTalent. Тут зібрані публічні профілі з реальними проєктами, стеком технологій і контекстом виконання, щоб оцінити не лише резюме, а й фактичну роботу.`,
      `Сторінки за ролями дають кращу стартову точку для пошуку. Замість широкого discovery можна одразу перейти до релевантної категорії, переглянути профілі, відкрити кейси та швидше зрозуміти, хто вже працював із подібними задачами, продуктами або технологіями.`,
    ];
  }

  return [
    `Browse ${role} portfolios on SearchTalent and review public profiles connected to real projects, technology stacks, and visible delivery context. This role page helps you start with relevant specialists instead of a generic candidate list.`,
    `By opening talent pages by role first, visitors can compare portfolios faster, inspect related work, and focus on creators who already show the kind of execution the role demands.`,
  ];
}

export function getTalentRoleFaq(locale: Locale, role: string): MarketingFaqItem[] {
  if (locale === "uk") {
    return [
      {
        question: `Як SearchTalent допомагає знайти ${role}?`,
        answer: `SearchTalent збирає публічні профілі фахівців ${role} із реальними проєктами, технологічним стеком і контекстом виконання. Ви можете оцінити роботу, перш ніж писати першого повідомлення.`,
      },
      {
        question: `Що містить профіль ${role}?`,
        answer: `Профіль містить роль, навички, технології, мови, формат роботи, досвід та портфоліо проєктів. Це допомагає зрозуміти, чи підходить фахівець під вашу задачу.`,
      },
      {
        question: `Скільки ${role}-фахівців доступно на SearchTalent?`,
        answer: `На сторінці показується актуальний лічильник публічних профілів. Ми оновлюємо перелік після модерації нових портфоліо, щоб список залишався релевантним.`,
      },
      {
        question: `Як зв'язатися з ${role}?`,
        answer: `Відкрийте профіль, перевірте публічні проєкти й контактні преференції. Фахівець сам вказує, як з ним зручно зв'язатися: email, Telegram, LinkedIn або інше.`,
      },
      {
        question: `Чи платний пошук ${role} на SearchTalent?`,
        answer: `Перегляд профілів і портфоліо — безкоштовний. Ви не платите, щоб знайти фахівця і оцінити його роботу до першого контакту.`,
      },
    ];
  }

  return [
    {
      question: `How does SearchTalent help find ${role} talent?`,
      answer: `SearchTalent curates public ${role} profiles with real projects, technology stacks, and delivery context. You can evaluate the work before sending the first message.`,
    },
    {
      question: `What does a ${role} profile include?`,
      answer: `A profile includes role, skills, stack, languages, work format, experience, and a project portfolio. That makes it easier to decide whether the specialist matches your brief.`,
    },
    {
      question: `How many ${role} specialists are available?`,
      answer: `The live counter on the page shows the current number of public profiles. We update the list as new portfolios pass moderation.`,
    },
    {
      question: `How do I contact a ${role}?`,
      answer: `Open the profile, review public projects, and check the contact preferences. Each specialist chooses how they prefer to be reached — email, Telegram, LinkedIn, or another channel.`,
    },
    {
      question: `Is ${role} search on SearchTalent free?`,
      answer: `Browsing profiles and portfolios is free. You don't pay to find a specialist or review their public work before first contact.`,
    },
  ];
}

export function getTechnologyTalentsIntro(locale: Locale, technology: string) {
  if (locale === "uk") {
    return [
      `На цій сторінці зібрані публічні профілі фахівців, які працюють із ${technology}. Кожен профіль містить реальні проєкти, стек, формат роботи й контекст виконання, тож ви можете порівнювати не за ключовими словами, а за доказами роботи.`,
      `Використовуйте сторінку як стартову точку пошуку ${technology}-спеціалістів: відкривайте портфоліо, переглядайте проєкти, які вже зроблені з цим інструментом, і оцінюйте рівень експертизи до першого контакту.`,
    ];
  }

  return [
    `This page lists public profiles of specialists working with ${technology}. Every profile links to real projects, stack details, preferred work format, and delivery context — so you can compare by proof of work, not keywords.`,
    `Use it as a starting point for your ${technology} search: open portfolios, review shipped projects built with the tool, and assess expertise before reaching out.`,
  ];
}

export function getTechnologyTalentsFaq(
  locale: Locale,
  technology: string,
): MarketingFaqItem[] {
  if (locale === "uk") {
    return [
      {
        question: `Як знайти ${technology}-фахівця на SearchTalent?`,
        answer: `Переглядайте профілі у списку, відкривайте проєкти та перевіряйте, скільки досвіду має спеціаліст саме з ${technology}. Публічні портфоліо дають вам прямий сигнал про рівень.`,
      },
      {
        question: `Чим ця сторінка корисна?`,
        answer: `Вона показує лише тих авторів, чиї профілі публічно вказують ${technology} у стеку. Це скорочує список і робить discovery швидшим.`,
      },
      {
        question: `Як оцінити рівень ${technology}-експертизи?`,
        answer: `Відкрийте проєкти фахівця: перевірте обсяг роботи, складність задач, посилання на live-продукти й репозиторії, якщо вони є у портфоліо.`,
      },
      {
        question: `Чи можна фільтрувати фахівців за локацією та форматом роботи?`,
        answer: `Так. Відкривайте сторінку талантів і використовуйте фільтри discovery — країна, формат, досвід — щоб звузити результат до релевантного.`,
      },
    ];
  }

  return [
    {
      question: `How do I find a ${technology} specialist on SearchTalent?`,
      answer: `Browse the profiles on this page, open linked projects, and review how much ${technology} work each specialist has shipped. Public portfolios give you a direct signal of seniority.`,
    },
    {
      question: `Why is this page useful?`,
      answer: `It only lists creators whose public profiles explicitly include ${technology} in their stack. That shortens the discovery list and speeds up exploration.`,
    },
    {
      question: `How do I assess ${technology} expertise?`,
      answer: `Open the specialist's projects and inspect scope, complexity, and any links to live products or repositories included in the portfolio.`,
    },
    {
      question: `Can I filter specialists by location or work format?`,
      answer: `Yes. Go to the main talents page and use the discovery filters — country, work format, experience — to narrow the list further.`,
    },
  ];
}

export function getProjectsByTechnologyIntro(
  locale: Locale,
  technology: string,
) {
  if (locale === "uk") {
    return [
      `Публічні IT-проєкти, побудовані з ${technology}. На кожній сторінці — опис, стек, скриншоти та автор, тому ви можете оцінити результат роботи до контакту.`,
      `Використовуйте каталог як джерело натхнення для власних портфоліо або як інструмент discovery: від проєкту легко перейти до профілю автора та інших робіт у подібному стеку.`,
    ];
  }

  return [
    `Public IT projects built with ${technology}. Each project page shows a description, stack, screenshots, and the creator — so you can evaluate the outcome before reaching out.`,
    `Use the catalog for portfolio inspiration or as a discovery tool: each project links back to the creator profile and related work in the same stack.`,
  ];
}

export function getArticleCategoryIntro(locale: Locale, category: string) {
  if (locale === "uk") {
    return [
      `Матеріали категорії ${category} на SearchTalent — технічні гайди, кейси, новини та поради для IT-спільноти. Публікації допомагають зрозуміти сучасний контекст розробки, ремесла та побудови портфоліо.`,
      `Читайте статті, підписуйтеся на авторів, які публікують регулярні матеріали, та переходьте до їхніх профілів і проєктів, щоб побачити, як технічний контент підкріплений реальною роботою.`,
    ];
  }

  return [
    `${category} articles on SearchTalent — technical guides, case studies, news, and insights for the IT community. Articles give you the current context around development, craft, and portfolio building.`,
    `Read the pieces, follow authors who publish consistently, and jump to their profiles and projects to see how the written content is backed by real shipped work.`,
  ];
}

