import type { Locale } from "@/lib/i18n/config";

export type LegalDocumentKey = "terms" | "privacy" | "cookies";

type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type LegalDocument = {
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  hubLabel: string;
  sections: LegalSection[];
};

type LegalIndexContent = {
  title: string;
  description: string;
  eyebrow: string;
  cards: Array<{
    href: `/${LegalDocumentKey}`;
    title: string;
    description: string;
  }>;
};

const legalDocuments: Record<Locale, Record<LegalDocumentKey, LegalDocument>> = {
  en: {
    terms: {
      title: "Terms of Service",
      description:
        "The rules for using SearchTalent — publishing content, interacting with the community, and keeping your account.",
      eyebrow: "Legal",
      intro:
        "These Terms describe the rules for using SearchTalent. They form a living document and may expand as the product grows.",
      lastUpdatedLabel: "Last updated",
      lastUpdatedValue: "July 27, 2026",
      hubLabel: "Legal hub",
      sections: [
        {
          title: "Using the platform",
          paragraphs: [
            "SearchTalent lets people create accounts, publish profiles and projects, write articles, run and answer polls, comment, react, vote, follow others, and explore public work across the community.",
            "By using the service, you agree to use it lawfully, respectfully, and in a way that does not harm the platform or other users.",
          ],
          bullets: [
            "Do not impersonate another person or organization.",
            "Do not upload or publish content you do not have the rights to use.",
            "Do not try to disrupt the service, bypass restrictions, or access data that is not yours.",
          ],
        },
        {
          title: "Who can use SearchTalent",
          paragraphs: [
            "SearchTalent is not intended for children. You must be at least 16 years old to create an account. If the law where you live sets a higher age for agreeing to online services on your own, that age applies instead.",
            "If we learn that an account belongs to someone below that age, we may remove it.",
          ],
        },
        {
          title: "Accounts and content",
          paragraphs: [
            "You are responsible for the accuracy of the information you publish in your account, profile, projects, articles, polls, and comments.",
            "You keep ownership of your content. To make the platform work, you grant SearchTalent a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, resize, reformat, and publicly display the content you choose to publish, and to pass those rights on to the hosting, storage, and delivery providers listed in the Privacy Policy.",
            "That licence covers the derived assets the platform generates from public content — preview thumbnails, social-media preview images for your public pages — and showing your content in feeds, search results, recommendations, and rating or leaderboard listings. We may also use short excerpts and preview images of already-public content to promote the platform itself, for example in a post about a published project or article.",
            "The licence exists only so the service can operate and ends when you delete the content or your account. Copies already shared by other people, cached by third parties, or held in backups for a limited period may persist beyond that point.",
          ],
        },
        {
          title: "Community conduct",
          paragraphs: [
            "SearchTalent includes community features such as comments, reactions, votes, follows, and a public rating and leaderboard.",
            "Use them in good faith. Harassment, hate speech, spam, and attempts to manipulate ratings, votes, or rankings — for example through fake accounts or coordinated voting — are not allowed.",
          ],
        },
        {
          title: "AI features",
          paragraphs: [
            "Some optional features use AI to help you draft or summarize content. The content you provide is processed by a third-party AI provider, as described in the Privacy Policy.",
            "You are responsible for reviewing AI-assisted output before you publish it and for ensuring the content you share complies with these Terms.",
          ],
        },
        {
          title: "Moderation and access",
          paragraphs: [
            "Content may be reviewed by automated and manual moderation. We may place content under review, remove it, or restrict access to the platform if material is illegal, abusive, misleading, or clearly unsafe for the product and its users.",
            "We may also update or discontinue features as the project evolves.",
          ],
        },
        {
          title: "Deleting your account",
          paragraphs: [
            "You can delete your account at any time from your profile settings, confirmed with a code sent to your email.",
            "You choose how deletion happens: full erasure removes your profile, projects, articles, comments, and related data; or you can keep your articles and comments as anonymous content attributed to a deleted user while the rest of your account is removed. Deletion is permanent and cannot be undone.",
          ],
        },
        {
          title: "Future changes",
          paragraphs: [
            "Because SearchTalent may grow from an academic project into a production platform, these Terms may be updated to reflect new functionality, billing, moderation, or business requirements.",
            "If major changes happen, the updated version will be published on this page with a new date.",
          ],
        },
        {
          title: "Contact",
          paragraphs: [
            "If you have questions about these Terms, contact us at support.searchtalent@gmail.com or through the contacts page.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      description:
        "What data SearchTalent collects, how it is used and shared, and the choices and rights you have.",
      eyebrow: "Legal",
      intro:
        "This Privacy Policy explains what data SearchTalent handles, why it is needed, who processes it, and the rights you have over your information.",
      lastUpdatedLabel: "Last updated",
      lastUpdatedValue: "July 27, 2026",
      hubLabel: "Legal hub",
      sections: [
        {
          title: "Who is responsible for your data",
          paragraphs: [
            "SearchTalent is operated by a sole proprietorship registered in Ukraine, which is the controller of the personal data described in this policy.",
            "For any privacy question, or to exercise the rights described below, write to support.searchtalent@gmail.com. We will provide the registered name and postal address of the controller on request.",
          ],
        },
        {
          title: "What data we collect",
          paragraphs: [
            "SearchTalent collects the data you provide when you create an account and build your public presence, together with the content and activity you generate while using the platform.",
          ],
          bullets: [
            "Account and authentication data: email address and login identifiers, including data from GitHub if you sign in or connect a repository through it.",
            "Profile and contact details: name, username, headline, bio, location, avatar and cover image, and any contact details or links you add (email, phone, Telegram, website, GitHub, LinkedIn, and other social or portfolio links).",
            "Professional information: skills, languages, work experience, education, certificates (including any files you upload), experience level, employment and work-format preferences, and salary expectations if you choose to provide them.",
            "Content and community activity: projects, articles, polls and your poll responses, comments, reactions, votes, follows, bookmarks, badges, notifications, and your position on the leaderboard.",
            "Feedback you send: the name, email, and message you submit through the feedback form.",
            "Technical and usage data: information needed for security, reliability, and performance, and aggregate view counts on content.",
          ],
        },
        {
          title: "Why we use it",
          paragraphs: [
            "Your data is used to authenticate access, display the public pages and content you choose to publish, power search and discovery, calculate ratings, badges, and leaderboards, deliver notifications, and respond to feedback or reports.",
            "Some technical data is also used to keep the service secure, reliable, and performant, and to moderate content for the safety of the platform and its users.",
          ],
        },
        {
          title: "The legal bases we rely on",
          paragraphs: [
            "Where data protection law such as the GDPR applies to you, we process your data on the following bases.",
          ],
          bullets: [
            "Performance of a contract — creating and running your account, publishing the profile and content you choose to share, and providing the community features described in the Terms of Service.",
            "Your consent — optional analytics and the cookie categories you allow, and the optional AI features. You can withdraw consent at any time, which does not affect processing that already happened.",
            "Our legitimate interests — keeping the platform secure and reliable, preventing spam, abuse, and rating manipulation, and moderating content for the safety of users.",
            "Legal obligations — where we are required to keep, provide, or remove data to comply with the law.",
          ],
        },
        {
          title: "Public and private data",
          paragraphs: [
            "Much of what you add is intended to be public — your profile, projects, articles, polls, and comments — and you control which profile sections are visible through your profile visibility settings.",
            "Other information, such as authentication data, your email, feedback submissions, and internal technical records, is used only to operate the service and is not made public.",
          ],
        },
        {
          title: "Service providers and where data goes",
          paragraphs: [
            "SearchTalent relies on trusted third-party providers to run the platform. Your data may be stored and processed by them, which can include servers located outside your country.",
          ],
          bullets: [
            "Supabase — database, authentication, and file storage.",
            "Vercel — application hosting and, only after you allow analytics, usage and performance measurement.",
            "Cloudflare R2 — storage and delivery of uploaded media and documents.",
            "Email delivery — sending messages such as the code that confirms account deletion, handled through our authentication and email infrastructure.",
            "GitHub — optional sign-in and repository import, if you choose to use it.",
            "Google (Gemini) — optional AI features, as described below.",
            "Google Analytics, Ahrefs Web Analytics, and Plerdy — measurement of usage, traffic, and which parts of a page people interact with. These load only after you allow analytics cookies and are listed in the Cookie Policy.",
            "GIPHY — the GIF search you can use in comments runs through our own server, but the GIF files themselves are delivered from GIPHY's network, which therefore receives your IP address and browser details as part of loading them.",
          ],
        },
        {
          title: "Sending data abroad",
          paragraphs: [
            "The providers above operate globally, so your data may be processed outside Ukraine and outside the European Economic Area — most often in the United States.",
            "Where that happens, the transfer relies on the safeguards those providers commit to, such as the European Commission's standard contractual clauses and their own data processing terms. You can ask us which safeguard applies to a specific provider.",
          ],
        },
        {
          title: "AI features",
          paragraphs: [
            "Some optional features use AI to help you draft or summarize content. When you use them, the text and context you provide — which may include profile or project information — is sent to Google's Gemini API to generate a response.",
            "We use the Gemini API on a paid tier. Under Google's terms for paid use, the content sent and the output generated are not used to train or improve Google's models; Google may still retain them for a limited period to detect abuse.",
            "These features are optional. Please avoid submitting information you do not want processed by a third-party AI provider.",
          ],
        },
        {
          title: "Analytics and cookies",
          paragraphs: [
            "Usage and performance analytics run only after you allow the analytics category through the cookie consent banner; until then they stay off. The Cookie Policy names every measurement tool we use.",
            "View counts on content are stored in an aggregate form and are not used to build a profile of individual visitors. See the Cookie Policy for details on cookies and similar storage.",
          ],
        },
        {
          title: "Your rights",
          paragraphs: [
            "You can view and edit your account and profile data at any time from your profile settings, and export your profile as a PDF. Beyond what the settings already let you do, you have the following rights over your data.",
          ],
          bullets: [
            "Access — ask for a copy of the personal data we hold about you. If you need it in a machine-readable format rather than the profile PDF, ask us by email and we will prepare one.",
            "Correction — have inaccurate data fixed; most fields you can edit yourself.",
            "Deletion — remove your account and data, as described in the next section.",
            "Restriction and objection — ask us to pause certain processing, or object to processing we base on our legitimate interests.",
            "Withdrawing consent — turn off analytics cookies or stop using the optional AI features at any time.",
          ],
        },
        {
          title: "Making a request or a complaint",
          paragraphs: [
            "Send requests to support.searchtalent@gmail.com. We answer within 30 days, and will tell you if a request needs longer or if we cannot verify that it comes from the account owner.",
            "If you are unhappy with how we handled your data, you can complain to a data protection authority — in Ukraine, the Ukrainian Parliament Commissioner for Human Rights; in the European Economic Area, the supervisory authority of the country where you live.",
          ],
        },
        {
          title: "Deleting your account",
          paragraphs: [
            "You can delete your account from your profile settings. We email you a confirmation code, and you choose how deletion happens: full erasure removes your profile, projects, articles, comments, votes, and related data permanently; or you can keep your articles and comments as anonymous content attributed to a deleted user while the rest of your account is removed. In both cases your profile, projects, votes, likes, and saved data are deleted, and the action cannot be undone.",
          ],
        },
        {
          title: "Data retention",
          paragraphs: [
            "We keep your data while your account is active and remove or anonymize it when you delete your account as described above.",
            "Limited records may persist for a short time where needed for security, backups, or legal obligations.",
          ],
        },
        {
          title: "Contact and changes to this policy",
          paragraphs: [
            "If you have questions about privacy or want to exercise your rights, contact us at support.searchtalent@gmail.com or through the contacts page.",
            "As the platform evolves, this Privacy Policy may be updated. Significant changes will be published on this page with a new date.",
          ],
        },
      ],
    },
    cookies: {
      title: "Cookie Policy",
      description:
        "How SearchTalent uses cookies and similar storage for authentication, language, theme, and optional analytics.",
      eyebrow: "Legal",
      intro:
        "This Cookie Policy explains the role of cookies and similar browser storage on SearchTalent, and the choices you have.",
      lastUpdatedLabel: "Last updated",
      lastUpdatedValue: "July 27, 2026",
      hubLabel: "Legal hub",
      sections: [
        {
          title: "What cookies are used for",
          paragraphs: [
            "SearchTalent uses cookies and similar browser storage to keep you signed in, remember your language and theme, record your cookie choices, and — only if you allow it — measure usage and performance.",
            "Optional categories stay off until you make a clear choice through the consent banner or cookie settings.",
          ],
        },
        {
          title: "Essential cookies",
          paragraphs: [
            "These are required for the platform to work and cannot be turned off.",
          ],
          bullets: [
            "Authentication — keeps you signed in (set by our authentication provider, Supabase).",
            "Language — remembers your selected interface language.",
            "Cookie consent — stores your cookie choices so we do not ask again on every visit.",
          ],
        },
        {
          title: "Preference cookies",
          paragraphs: [
            "After you allow preferences, a cookie remembers your interface theme (light or dark).",
            "You can withdraw or change that choice later through the cookie settings entry point in the site footer.",
          ],
        },
        {
          title: "Analytics",
          paragraphs: [
            "If you allow the analytics category, we load the measurement tools below. None of them run before your consent.",
          ],
          bullets: [
            "Vercel Web Analytics and Speed Insights — aggregate traffic and page performance.",
            "Google Analytics 4 — aggregate usage statistics. It sets its own cookies and processes data on Google's infrastructure.",
            "Ahrefs Web Analytics — cookieless traffic measurement, gated together with the rest so that the analytics switch means what it says.",
            "Plerdy — click maps and heatmaps showing which parts of a page people interact with.",
          ],
        },
        {
          title: "Turning analytics off again",
          paragraphs: [
            "If you withdraw analytics consent, these tools are not loaded again. Some of them inject their own script or install browser globals when they start, so a tool that is already running in the current tab stops at your next page load rather than instantly.",
            "We do not currently use marketing or advertising cookies. That category is reserved for possible future use and stays disabled unless you allow it.",
          ],
        },
        {
          title: "Managing your choices",
          paragraphs: [
            "You can review or change your cookie choices at any time through the cookie settings link in the site footer.",
          ],
        },
        {
          title: "Future updates",
          paragraphs: [
            "If marketing, personalization, or additional third-party tools are added later, this Cookie Policy will be expanded to reflect those categories clearly.",
          ],
        },
      ],
    },
  },
  uk: {
    terms: {
      title: "Умови користування",
      description:
        "Правила користування SearchTalent — публікація контенту, взаємодія зі спільнотою та збереження акаунта.",
      eyebrow: "Правова інформація",
      intro:
        "Ці Умови описують правила користування SearchTalent. Документ є робочим і може розширюватися разом із розвитком продукту.",
      lastUpdatedLabel: "Останнє оновлення",
      lastUpdatedValue: "27 липня 2026",
      hubLabel: "Правовий розділ",
      sections: [
        {
          title: "Користування платформою",
          paragraphs: [
            "SearchTalent дає змогу створювати акаунти, публікувати профілі та проєкти, писати статті, створювати опитування й відповідати на них, коментувати, ставити реакції, голосувати, підписуватися на інших та переглядати відкриті роботи спільноти.",
            "Користуючись сервісом, ви погоджуєтеся використовувати його законно, добросовісно та без шкоди для платформи й інших користувачів.",
          ],
          bullets: [
            "Не видавайте себе за іншу людину чи компанію.",
            "Не публікуйте контент, на який у вас немає прав.",
            "Не намагайтеся зламати сервіс, обходити обмеження або отримувати доступ до чужих даних.",
          ],
        },
        {
          title: "Хто може користуватися SearchTalent",
          paragraphs: [
            "SearchTalent не призначений для дітей. Щоб створити акаунт, вам має бути щонайменше 16 років. Якщо законодавство вашої країни встановлює вищий вік для самостійної згоди на користування онлайн-сервісами, застосовується він.",
            "Якщо ми дізнаємося, що акаунт належить особі молодшого віку, ми можемо його видалити.",
          ],
        },
        {
          title: "Акаунт і контент",
          paragraphs: [
            "Ви відповідаєте за достовірність інформації, яку публікуєте в акаунті, профілі, проєктах, статтях, опитуваннях і коментарях.",
            "Права на ваш контент залишаються за вами. Щоб платформа могла працювати, ви надаєте SearchTalent невиключну, всесвітню, безоплатну ліцензію розміщувати, зберігати, відтворювати, змінювати розмір і формат та публічно показувати контент, який ви публікуєте, а також передавати ці права постачальникам хостингу, зберігання й доставки, перелік яких є в Політиці конфіденційності.",
            "Ця ліцензія охоплює похідні матеріали, які платформа створює з публічного контенту — прев'ю-мініатюри та зображення для соцмереж для ваших публічних сторінок, — а також показ вашого контенту в стрічках, результатах пошуку, рекомендаціях і рейтингових чи лідербордних списках. Ми також можемо використовувати короткі уривки та прев'ю вже публічного контенту для промоції самої платформи, наприклад у публікації про опублікований проєкт чи статтю.",
            "Ліцензія існує лише для роботи сервісу й припиняється, коли ви видаляєте контент або акаунт. Копії, якими вже поділилися інші люди, кеші сторонніх сервісів і резервні копії, що зберігаються обмежений час, можуть існувати й після цього.",
          ],
        },
        {
          title: "Поведінка у спільноті",
          paragraphs: [
            "SearchTalent має функції спільноти: коментарі, реакції, голоси, підписки, а також публічний рейтинг і лідерборд.",
            "Користуйтеся ними добросовісно. Цькування, мова ворожнечі, спам і спроби маніпулювати рейтингом, голосами чи позиціями — наприклад через фейкові акаунти або скоординоване голосування — заборонені.",
          ],
        },
        {
          title: "AI-функції",
          paragraphs: [
            "Деякі необов'язкові функції використовують AI, щоб допомогти створити чернетку або стислий виклад контенту. Наданий вами контент обробляється стороннім AI-провайдером, як описано в Політиці конфіденційності.",
            "Ви відповідаєте за перевірку згенерованого AI результату перед публікацією та за відповідність контенту цим Умовам.",
          ],
        },
        {
          title: "Модерація та доступ",
          paragraphs: [
            "Контент може перевірятися автоматичною та ручною модерацією. Ми можемо відправити контент на перевірку, прибрати його або обмежити доступ до платформи, якщо матеріал є незаконним, образливим, оманливим або небезпечним для продукту та його користувачів.",
            "Ми також можемо змінювати або прибирати окремі функції в міру розвитку продукту.",
          ],
        },
        {
          title: "Видалення акаунта",
          paragraphs: [
            "Ви можете видалити акаунт будь-коли в налаштуваннях профілю, підтвердивши це кодом, надісланим на email.",
            "Ви обираєте спосіб видалення: повне видалення прибирає профіль, проєкти, статті, коментарі та пов'язані дані; або ви можете залишити статті й коментарі як анонімний контент із підписом «Видалений користувач», а решту акаунта видалити. Видалення є остаточним і його неможливо скасувати.",
          ],
        },
        {
          title: "Подальші зміни",
          paragraphs: [
            "Оскільки SearchTalent може вирости з навчального проєкту в повноцінний продукт, ці Умови можуть доповнюватися новими положеннями про функціональність, модерацію, оплату чи бізнес-процеси.",
            "Якщо з'являться суттєві зміни, актуальна версія буде опублікована на цій сторінці з новою датою.",
          ],
        },
        {
          title: "Контакти",
          paragraphs: [
            "Якщо у вас є питання щодо цих Умов, напишіть нам на support.searchtalent@gmail.com або через сторінку контактів.",
          ],
        },
      ],
    },
    privacy: {
      title: "Політика конфіденційності",
      description:
        "Які дані збирає SearchTalent, як вони використовуються й кому передаються, та які у вас права й вибір.",
      eyebrow: "Правова інформація",
      intro:
        "Ця Політика конфіденційності пояснює, які дані обробляє SearchTalent, навіщо вони потрібні, хто їх обробляє та які права ви маєте щодо своєї інформації.",
      lastUpdatedLabel: "Останнє оновлення",
      lastUpdatedValue: "27 липня 2026",
      hubLabel: "Правовий розділ",
      sections: [
        {
          title: "Хто відповідає за ваші дані",
          paragraphs: [
            "SearchTalent — платформа, якою керує зареєстрована в Україні фізична особа-підприємець; вона є контролером персональних даних, описаних у цій політиці.",
            "З будь-якого питання щодо приватності або щоб скористатися описаними нижче правами, пишіть на support.searchtalent@gmail.com. Зареєстроване найменування та поштову адресу контролера надаємо на запит.",
          ],
        },
        {
          title: "Які дані ми збираємо",
          paragraphs: [
            "SearchTalent збирає дані, які ви надаєте під час створення акаунта та формування публічної присутності, а також контент і активність, що ви створюєте під час користування платформою.",
          ],
          bullets: [
            "Дані акаунта й авторизації: email та ідентифікатори входу, зокрема дані з GitHub, якщо ви входите чи під'єднуєте репозиторій через нього.",
            "Профіль і контакти: ім'я, username, заголовок, біографія, локація, аватар і обкладинка, а також контакти й посилання, які ви додаєте (email, телефон, Telegram, вебсайт, GitHub, LinkedIn та інші соц- чи портфоліо-посилання).",
            "Професійна інформація: навички, мови, досвід роботи, освіта, сертифікати (зокрема завантажені файли), рівень досвіду, бажані типи зайнятості й формати роботи, а також зарплатні очікування, якщо ви їх вказуєте.",
            "Контент і активність у спільноті: проєкти, статті, опитування та ваші відповіді на них, коментарі, реакції, голоси, підписки, закладки, бейджі, сповіщення й позиція в рейтингу.",
            "Звернення через форму зворотного зв'язку: ім'я, email і повідомлення, які ви надсилаєте.",
            "Технічні дані та дані використання: інформація, потрібна для безпеки, стабільності й продуктивності, та агреговані лічильники переглядів контенту.",
          ],
        },
        {
          title: "Навіщо це потрібно",
          paragraphs: [
            "Ці дані потрібні для авторизації, показу публічних сторінок і контенту, який ви публікуєте, роботи пошуку й навігації, обчислення рейтингів, бейджів і лідербордів, доставки сповіщень та відповідей на звернення.",
            "Частина технічних даних також використовується для безпеки, стабільності й продуктивності сервісу та для модерації контенту заради безпеки платформи й користувачів.",
          ],
        },
        {
          title: "На яких правових підставах ми це робимо",
          paragraphs: [
            "Якщо до вас застосовується законодавство про захист даних, зокрема GDPR, ми обробляємо ваші дані на таких підставах.",
          ],
          bullets: [
            "Виконання договору — створення й робота акаунта, публікація профілю та контенту, який ви обираєте показувати, і надання функцій спільноти, описаних в Умовах користування.",
            "Ваша згода — необов'язкова аналітика та категорії cookies, які ви дозволяєте, а також необов'язкові AI-функції. Згоду можна відкликати будь-коли, це не впливає на обробку, що вже відбулася.",
            "Наші законні інтереси — безпека й стабільність платформи, запобігання спаму, зловживанням і маніпуляціям рейтингом, модерація контенту заради безпеки користувачів.",
            "Правові зобов'язання — коли ми зобов'язані зберігати, надавати або видаляти дані на вимогу закону.",
          ],
        },
        {
          title: "Публічні та непублічні дані",
          paragraphs: [
            "Значна частина того, що ви додаєте, за задумом є публічною — профіль, проєкти, статті, опитування й коментарі, — і ви керуєте тим, які секції профілю видно, через налаштування видимості профілю.",
            "Інша інформація, як-от дані авторизації, ваш email, звернення через форму зворотного зв'язку та внутрішні технічні записи, використовується лише для роботи сервісу й не стає публічною.",
          ],
        },
        {
          title: "Постачальники послуг і куди йдуть дані",
          paragraphs: [
            "Для роботи платформи SearchTalent користується надійними сторонніми сервісами. Ваші дані можуть зберігатися й оброблятися ними, зокрема на серверах за межами вашої країни.",
          ],
          bullets: [
            "Supabase — база даних, авторизація та зберігання файлів.",
            "Vercel — хостинг застосунку та, лише після вашого дозволу на аналітику, вимірювання використання й продуктивності.",
            "Cloudflare R2 — зберігання й доставка завантажених медіа та документів.",
            "Доставка email — надсилання повідомлень, як-от коду підтвердження видалення акаунта, через нашу інфраструктуру авторизації та email.",
            "GitHub — необов'язковий вхід та імпорт репозиторіїв, якщо ви ним користуєтеся.",
            "Google (Gemini) — необов'язкові AI-функції, як описано нижче.",
            "Google Analytics, Ahrefs Web Analytics і Plerdy — вимірювання використання, трафіку та того, з якими частинами сторінки взаємодіють користувачі. Вони завантажуються лише після вашого дозволу на аналітичні cookies й перелічені в Політиці cookies.",
            "GIPHY — пошук GIF у коментарях іде через наш сервер, але самі GIF-файли доставляються з мережі GIPHY, яка тому отримує вашу IP-адресу та дані браузера під час їх завантаження.",
          ],
        },
        {
          title: "Передавання даних за кордон",
          paragraphs: [
            "Наведені вище постачальники працюють глобально, тому ваші дані можуть обробляти за межами України та Європейського економічного простору — найчастіше у США.",
            "У таких випадках передавання спирається на гарантії, які надають ці постачальники, зокрема стандартні договірні положення Європейської Комісії та їхні власні умови обробки даних. Ви можете запитати, яка саме гарантія застосовується до конкретного постачальника.",
          ],
        },
        {
          title: "AI-функції",
          paragraphs: [
            "Деякі необов'язкові функції використовують AI, щоб допомогти створити чернетку або стислий виклад контенту. Коли ви ними користуєтеся, наданий вами текст і контекст — який може містити дані профілю чи проєкту — надсилається до Google Gemini API для генерації відповіді.",
            "Ми користуємося Gemini API на платному тарифі. За умовами Google для платного використання надісланий контент і згенерований результат не використовуються для навчання чи покращення моделей Google; Google може зберігати їх обмежений час для виявлення зловживань.",
            "Ці функції необов'язкові. Будь ласка, не надсилайте інформацію, яку не хочете передавати сторонньому AI-провайдеру.",
          ],
        },
        {
          title: "Аналітика та cookies",
          paragraphs: [
            "Аналітика використання й продуктивності працює лише після того, як ви дозволите категорію «аналітика» в банері згоди на cookies; до цього вона вимкнена. Політика cookies називає всі інструменти вимірювання, які ми використовуємо.",
            "Лічильники переглядів контенту зберігаються в агрегованому вигляді й не використовуються для створення профілю окремого відвідувача. Деталі про cookies та подібне сховище — у Політиці cookies.",
          ],
        },
        {
          title: "Ваші права",
          paragraphs: [
            "Ви будь-коли можете переглянути й відредагувати дані акаунта та профілю в налаштуваннях профілю, а також експортувати профіль у PDF. Крім того, що вже доступно в налаштуваннях, ви маєте такі права щодо своїх даних.",
          ],
          bullets: [
            "Доступ — запитати копію персональних даних, які ми про вас зберігаємо. Якщо потрібен машиночитний формат, а не PDF профілю, напишіть нам, і ми його підготуємо.",
            "Виправлення — виправити неточні дані; більшість полів ви можете змінити самостійно.",
            "Видалення — видалити акаунт і дані, як описано в наступному розділі.",
            "Обмеження та заперечення — попросити припинити певну обробку або заперечити проти обробки, яку ми здійснюємо на підставі законних інтересів.",
            "Відкликання згоди — вимкнути аналітичні cookies або перестати користуватися необов'язковими AI-функціями будь-коли.",
          ],
        },
        {
          title: "Як надіслати запит або скаргу",
          paragraphs: [
            "Запити надсилайте на support.searchtalent@gmail.com. Ми відповідаємо протягом 30 днів і повідомимо, якщо запит потребує більше часу або якщо ми не можемо підтвердити, що він надійшов від власника акаунта.",
            "Якщо вас не влаштовує те, як ми повелися з вашими даними, ви можете поскаржитися до органу із захисту даних — в Україні це Уповноважений Верховної Ради України з прав людини, у Європейському економічному просторі — наглядовий орган країни вашого проживання.",
          ],
        },
        {
          title: "Видалення акаунта",
          paragraphs: [
            "Видалити акаунт можна в налаштуваннях профілю. Ми надсилаємо код підтвердження на email, і ви обираєте спосіб видалення: повне видалення безповоротно прибирає профіль, проєкти, статті, коментарі, голоси та пов'язані дані; або ви можете залишити статті й коментарі як анонімний контент із підписом «Видалений користувач», а решту акаунта видалити. В обох випадках профіль, проєкти, голоси, лайки та збережені дані видаляються, і цю дію неможливо скасувати.",
          ],
        },
        {
          title: "Зберігання даних",
          paragraphs: [
            "Ми зберігаємо ваші дані, поки акаунт активний, і видаляємо або анонімізуємо їх, коли ви видаляєте акаунт у спосіб, описаний вище.",
            "Окремі записи можуть зберігатися нетривалий час, якщо це потрібно для безпеки, резервних копій або виконання правових зобов'язань.",
          ],
        },
        {
          title: "Контакти та зміни в політиці",
          paragraphs: [
            "Якщо у вас є питання щодо конфіденційності або ви хочете скористатися своїми правами, напишіть нам на support.searchtalent@gmail.com або через сторінку контактів.",
            "Із розвитком платформи ця Політика конфіденційності може оновлюватися. Про суттєві зміни ми повідомимо на цій сторінці з новою датою.",
          ],
        },
      ],
    },
    cookies: {
      title: "Політика cookies",
      description:
        "Як SearchTalent використовує cookies та подібне сховище для авторизації, мови, теми й необов'язкової аналітики.",
      eyebrow: "Правова інформація",
      intro:
        "Ця Політика cookies пояснює, як SearchTalent використовує cookies і подібне браузерне сховище та який вибір ви маєте.",
      lastUpdatedLabel: "Останнє оновлення",
      lastUpdatedValue: "27 липня 2026",
      hubLabel: "Правовий розділ",
      sections: [
        {
          title: "Для чого використовуються cookies",
          paragraphs: [
            "SearchTalent використовує cookies і подібне браузерне сховище, щоб тримати вас у системі, запам'ятовувати мову й тему, зберігати ваш вибір щодо cookies та — лише з вашого дозволу — вимірювати використання й продуктивність.",
            "Необов'язкові категорії залишаються вимкненими, доки ви не зробите явний вибір у банері згоди або в налаштуваннях cookies.",
          ],
        },
        {
          title: "Обов'язкові cookies",
          paragraphs: [
            "Вони потрібні для роботи платформи й не можуть бути вимкнені.",
          ],
          bullets: [
            "Авторизація — тримає вас у системі (встановлюється нашим провайдером авторизації Supabase).",
            "Мова — запам'ятовує обрану мову інтерфейсу.",
            "Згода на cookies — зберігає ваш вибір, щоб не питати знову за кожного візиту.",
          ],
        },
        {
          title: "Cookies налаштувань",
          paragraphs: [
            "Після вашого дозволу на налаштування cookie запам'ятовує тему інтерфейсу (світлу чи темну).",
            "Змінити або відкликати цей дозвіл можна пізніше через налаштування cookies у футері сайту.",
          ],
        },
        {
          title: "Аналітика",
          paragraphs: [
            "Якщо ви дозволите категорію «аналітика», ми завантажуємо наведені нижче інструменти вимірювання. Жоден із них не працює до вашої згоди.",
          ],
          bullets: [
            "Vercel Web Analytics і Speed Insights — агрегований трафік і продуктивність сторінок.",
            "Google Analytics 4 — агрегована статистика використання. Встановлює власні cookies й обробляє дані на інфраструктурі Google.",
            "Ahrefs Web Analytics — вимірювання трафіку без cookies; ми все одно тримаємо його під згодою, щоб перемикач «аналітика» означав саме те, що написано.",
            "Plerdy — карти кліків і теплові карти, які показують, з якими частинами сторінки взаємодіють користувачі.",
          ],
        },
        {
          title: "Як вимкнути аналітику знову",
          paragraphs: [
            "Якщо ви відкликаєте згоду на аналітику, ці інструменти більше не завантажуються. Частина з них під час запуску додає власний скрипт або встановлює глобальні змінні в браузері, тому інструмент, який уже працює у поточній вкладці, зупиняється з наступним завантаженням сторінки, а не миттєво.",
            "Наразі ми не використовуємо маркетингові чи рекламні cookies. Ця категорія зарезервована для можливого майбутнього використання й лишається вимкненою, доки ви її не дозволите.",
          ],
        },
        {
          title: "Керування вибором",
          paragraphs: [
            "Переглянути чи змінити свій вибір щодо cookies можна будь-коли через посилання на налаштування cookies у футері сайту.",
          ],
        },
        {
          title: "Подальші оновлення",
          paragraphs: [
            "Якщо в майбутньому з'являться маркетингові, персоналізаційні або додаткові сторонні інструменти, ця політика буде доповнена відповідними категоріями.",
          ],
        },
      ],
    },
  },
};

const legalIndexContent: Record<Locale, LegalIndexContent> = {
  en: {
    eyebrow: "Legal",
    title: "Legal and policy pages",
    description:
      "Core platform documents that explain how SearchTalent works today and can expand as the product grows.",
    cards: [
      {
        href: "/terms",
        title: "Terms of Service",
        description: "Rules for using the platform, publishing content, and maintaining access.",
      },
      {
        href: "/privacy",
        title: "Privacy Policy",
        description: "How account, profile, and project data is handled on the platform.",
      },
      {
        href: "/cookies",
        title: "Cookie Policy",
        description: "How cookies and browser storage support authentication and preferences.",
      },
    ],
  },
  uk: {
    eyebrow: "Правова інформація",
    title: "Правові сторінки платформи",
    description:
      "Базові документи, які пояснюють, як SearchTalent працює зараз і як ці правила можуть розширюватися разом із продуктом.",
    cards: [
      {
        href: "/terms",
        title: "Умови користування",
        description: "Правила користування платформою, публікації контенту та доступу до сервісу.",
      },
      {
        href: "/privacy",
        title: "Політика конфіденційності",
        description: "Пояснення, як платформа працює з даними акаунта, профілю та проєктів.",
      },
      {
        href: "/cookies",
        title: "Політика cookies",
        description: "Як cookies і браузерне сховище підтримують авторизацію та налаштування.",
      },
    ],
  },
};

export function getLegalDocument(locale: Locale, key: LegalDocumentKey) {
  return legalDocuments[locale][key];
}

export function getLegalIndexContent(locale: Locale) {
  return legalIndexContent[locale];
}
