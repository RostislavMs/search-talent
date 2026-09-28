import type { Locale } from "@/lib/i18n/config";
import { slugify } from "@/lib/slug";

export type MarketingFaqItem = {
  question: string;
  answer: string;
};

const marketingContent = {
  en: {
    home: {
      featuresTitle: "What you get",
      features: [
        {
          title: "Your own style",
          description: "Colours, fonts, background and section order: the page looks the way you want.",
        },
        {
          title: "A score with tips",
          description: "See your portfolio's score and what to add to make it stronger.",
        },
        {
          title: "A place in the ranking",
          description: "Strong work rises to the top, where more people see it.",
        },
        {
          title: "One link to share",
          description: "Put it in your CV or on LinkedIn, or download your portfolio as a PDF.",
        },
      ],
      browseByRoleTitle: "Browse by role",
      browseByRoleDescription:
        "Start with the role you need and jump straight into public portfolios with live project context.",
      featuredTalentsTitle: "Featured talents",
      featuredTalentsDescription:
        "A curated set of standout profiles with real work, clear positioning, and public portfolios.",
      latestArticlesTitle: "Latest articles",
      latestArticlesDescription: "Tips on portfolios, careers and working in tech.",
      howItWorksTitle: "How it works",
      talentTrackTitle: "If you're a specialist",
      explorerTrackTitle: "If you're looking for one",
      talentSteps: [
        {
          title: "Create a profile",
          description: "Add your name, field and skills. It takes a few minutes.",
        },
        {
          title: "Add your work",
          description: "Import code from GitHub or GitLab, or upload images and videos.",
        },
        {
          title: "Style it and share",
          description: "Pick colours and a font, check your score and tips, and put the link in your CV.",
        },
      ],
      explorerSteps: [
        {
          title: "Pick a field",
          description: "Development, design, video, 3D and more.",
        },
        {
          title: "Look at the work",
          description: "Projects with a description and a result show how someone works.",
        },
        {
          title: "Get in touch",
          description: "If someone is open to freelance, a job or collaboration, press “Contact” on their page.",
        },
      ],
      faqTitle: "FAQ",
      faq: [
        {
          question: "What is SearchTalent?",
          answer:
            "A free portfolio platform. You style your page your way, add your work, get a score with tips to raise it, and share your profile with one link.",
        },
        {
          question: "Who is it for?",
          answer:
            "Tech and creative professionals: developers, designers, video editors, 3D and motion designers, QA engineers and analysts. Beginners too.",
        },
        {
          question: "Is it free?",
          answer: "Yes. Creating a profile and publishing your work are free.",
        },
        {
          question: "How long does the first project take?",
          answer:
            "About 10 minutes. Code can be imported from GitHub or GitLab, which fills in the title, description and technologies for you. Other work is added by hand: a title, a description, images or a video link.",
        },
        {
          question: "How does the ranking work?",
          answer:
            "It looks at how fully your work and profile are described and how people respond to them. A few random likes won't lift weak work. The rating guide has the details.",
        },
        {
          question: "Is this a job board?",
          answer:
            "No. There are no vacancies or applications. But specialists can show what they're open to (freelance, a job, an internship, collaboration or mentoring), and you can get in touch with them directly.",
        },
        {
          question: "Can I browse portfolios without an account?",
          answer: "Yes. Profiles, projects and articles are open to everyone.",
        },
        {
          question: "Why a portfolio and not just a resume?",
          answer:
            "A resume says what you can do. A portfolio shows it: real work, your decisions and the result.",
        },
      ] satisfies MarketingFaqItem[],
      footerCtaTitle: "Build a portfolio that proves what you can do",
      footerCtaDescription:
        "Create a public SearchTalent profile, publish your real projects, and let your work speak for itself in front of a community that values craft.",
    },
    talents: {
      title: "Discover IT Specialists with Real Project Portfolios",
      intro: [
        "SearchTalent helps the community discover IT specialists through real project portfolios instead of relying only on resumes. Public profiles show how specialists present their work, which technologies they use, and what kinds of products they have built. That means a stronger first signal the moment you open a profile.",
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
            "You can review a specialist's role, skills, technology stack, portfolio projects, what they are open to, and public profile information as you explore whose work to follow, learn from, or get in touch with.",
        },
        {
          question: "Does SearchTalent support browsing by role?",
          answer:
            "Yes. Talent directories can be explored by role and filtered further by what people are open to (freelance, a job, an internship, collaboration, mentoring), technologies, location, experience, and work format.",
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
      featuresTitle: "Що ви отримуєте",
      features: [
        {
          title: "Свій стиль",
          description: "Кольори, шрифти, фон і порядок блоків: сторінка виглядає так, як хочете ви.",
        },
        {
          title: "Оцінка і поради",
          description: "Бачите бал свого портфоліо і що додати, щоб воно стало сильнішим.",
        },
        {
          title: "Місце в рейтингу",
          description: "Сильні роботи піднімаються в топ, і їх бачить більше людей.",
        },
        {
          title: "Одне посилання",
          description: "Додайте його в резюме чи LinkedIn або завантажте портфоліо в PDF.",
        },
      ],
      browseByRoleTitle: "Перегляд за ролями",
      browseByRoleDescription:
        "Почніть з потрібної ролі та одразу переходьте до публічних портфоліо з реальними проєктами.",
      featuredTalentsTitle: "Рекомендовані таланти",
      featuredTalentsDescription:
        "Добірка сильних профілів з реальними роботами, чітким позиціонуванням і публічними кейсами.",
      latestArticlesTitle: "Останні статті",
      latestArticlesDescription: "Поради про портфоліо, кар'єру й роботу в IT.",
      howItWorksTitle: "Як це працює",
      talentTrackTitle: "Якщо ви фахівець",
      explorerTrackTitle: "Якщо ви шукаєте фахівця",
      talentSteps: [
        {
          title: "Створіть профіль",
          description: "Вкажіть ім'я, напрям і навички. Це займе кілька хвилин.",
        },
        {
          title: "Додайте роботи",
          description: "Імпортуйте код із GitHub чи GitLab або завантажте зображення й відео.",
        },
        {
          title: "Оформіть і поділіться",
          description: "Оберіть кольори й шрифт, подивіться оцінку з порадами і додайте посилання в резюме.",
        },
      ],
      explorerSteps: [
        {
          title: "Оберіть напрям",
          description: "Розробка, дизайн, відео, 3D та інші.",
        },
        {
          title: "Дивіться роботи",
          description: "Проєкти з описом і результатом показують, як людина працює.",
        },
        {
          title: "Напишіть автору",
          description: "Якщо людина відкрита до фрилансу, роботи чи співпраці, натисніть «Зв'язатися» на її сторінці.",
        },
      ],
      faqTitle: "Питання й відповіді",
      faq: [
        {
          question: "Що таке SearchTalent?",
          answer:
            "Безкоштовна платформа для портфоліо. Ви оформлюєте сторінку у своєму стилі, додаєте роботи, бачите оцінку з порадами, як її підняти, і ділитеся профілем одним посиланням.",
        },
        {
          question: "Для кого ця платформа?",
          answer:
            "Для людей IT- і творчих професій: розробників, дизайнерів, монтажерів, 3D- і моушн-дизайнерів, тестувальників, аналітиків. І для тих, хто тільки починає.",
        },
        {
          question: "Це безкоштовно?",
          answer: "Так. Створити профіль і публікувати роботи можна безкоштовно.",
        },
        {
          question: "Скільки часу займе перший проєкт?",
          answer:
            "Близько 10 хвилин. Код можна імпортувати з GitHub чи GitLab — назва, опис і технології підтягнуться самі. Інші роботи додаються вручну: назва, опис, зображення чи посилання на відео.",
        },
        {
          question: "Як працює рейтинг?",
          answer:
            "Рейтинг дивиться, наскільки повно описані ваші роботи й профіль і як на них реагують люди. Кілька випадкових лайків не піднімуть слабку роботу. Докладніше — у гайді по рейтингу.",
        },
        {
          question: "Це сайт вакансій?",
          answer:
            "Ні. Вакансій і відгуків на них тут немає. Але фахівці можуть показати, до чого відкриті (фриланс, робота, стажування, співпраця чи менторство), і їм можна написати напряму.",
        },
        {
          question: "Чи можна дивитися портфоліо без реєстрації?",
          answer: "Так. Профілі, проєкти й статті відкриті для всіх.",
        },
        {
          question: "Чим портфоліо краще за резюме?",
          answer:
            "Резюме розповідає, що ви вмієте. Портфоліо це показує: реальні роботи, ваші рішення й результат.",
        },
      ] satisfies MarketingFaqItem[],
      footerCtaTitle: "Створіть портфоліо, яке доводить ваш рівень",
      footerCtaDescription:
        "Створіть публічний профіль у SearchTalent, опублікуйте реальні проєкти й дайте своїй роботі говорити за вас у спільноті, що цінує ремесло.",
    },
    talents: {
      title: "Відкривайте IT-фахівців з реальними портфоліо",
      intro: [
        "SearchTalent допомагає спільноті знаходити IT-фахівців через реальні портфоліо проєктів, а не лише через резюме. Публічні профілі показують, як спеціаліст презентує свою роботу, якими технологіями користується та над якими продуктами вже працював. Це дає сильніший перший сигнал, щойно ви відкриваєте профіль.",
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
            "У профілі можна переглянути роль фахівця, навички, стек технологій, проєкти, до чого людина відкрита, та іншу публічну інформацію, коли досліджуєте, чиї роботи читати, у кого вчитися та кому написати.",
        },
        {
          question: "Чи підтримує SearchTalent перегляд за ролями?",
          answer:
            "Так. Каталоги талантів можна відкривати за ролями, а далі звужувати результати за тим, до чого людина відкрита (фриланс, робота, стажування, співпраця, менторство), технологіями, локацією, досвідом і форматом роботи.",
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
  return slugify(value, "item");
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
        answer: `Профіль містить роль, навички, технології, мови, досвід, портфоліо проєктів і те, до чого фахівець відкритий: фриланс, робота, стажування, співпраця чи менторство. Це допомагає зрозуміти, чи підходить він під вашу задачу.`,
      },
      {
        question: `Скільки ${role}-фахівців доступно на SearchTalent?`,
        answer: `На сторінці показується актуальний лічильник публічних профілів. Ми оновлюємо перелік після модерації нових портфоліо, щоб список залишався релевантним.`,
      },
      {
        question: `Як зв'язатися з ${role}?`,
        answer: `Відкрийте профіль і натисніть «Зв'язатися». Там — способи зв'язку, які фахівець обрав сам; пошту й телефон видно після входу. У каталозі можна відфільтрувати тих, хто відкритий до фрилансу, роботи чи співпраці.`,
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
      answer: `A profile includes role, skills, stack, languages, experience, a project portfolio, and what the specialist is open to: freelance, a job, an internship, collaboration, or mentoring. That makes it easier to decide whether they match your brief.`,
    },
    {
      question: `How many ${role} specialists are available?`,
      answer: `The live counter on the page shows the current number of public profiles. We update the list as new portfolios pass moderation.`,
    },
    {
      question: `How do I contact a ${role}?`,
      answer: `Open the profile and press “Contact”. You'll see the ways the specialist chose to be reached; email and phone are shown after you sign in. In the catalog you can filter for people open to freelance, a job, or collaboration.`,
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
        question: `Чи можна фільтрувати фахівців за тим, до чого вони відкриті?`,
        answer: `Так. На сторінці талантів є фільтри: до чого людина відкрита (фриланс, робота, стажування, співпраця, менторство), формат роботи, країна й досвід.`,
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
      question: `Can I filter specialists by what they are open to?`,
      answer: `Yes. The talents page has filters for what people are open to (freelance, a job, an internship, collaboration, mentoring), work format, country, and experience.`,
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

