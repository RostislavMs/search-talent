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
      lastUpdatedValue: "June 13, 2026",
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
          title: "Accounts and content",
          paragraphs: [
            "You are responsible for the accuracy of the information you publish in your account, profile, projects, articles, polls, and comments.",
            "You keep ownership of your content, but you allow SearchTalent to store, display, and process it so the service can work as intended.",
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
      lastUpdatedValue: "June 13, 2026",
      hubLabel: "Legal hub",
      sections: [
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
          ],
        },
        {
          title: "AI features",
          paragraphs: [
            "Some optional features use AI to help you draft or summarize content. When you use them, the text and context you provide — which may include profile or project information — is sent to Google's Gemini API to generate a response.",
            "These features are optional. Please avoid submitting information you do not want processed by a third-party AI provider.",
          ],
        },
        {
          title: "Analytics and cookies",
          paragraphs: [
            "Usage and performance analytics run only after you allow the analytics category through the cookie consent banner; until then they stay off.",
            "View counts on content are stored in an aggregate form and are not used to build a profile of individual visitors. See the Cookie Policy for details on cookies and similar storage.",
          ],
        },
        {
          title: "Your rights and deleting your account",
          paragraphs: [
            "You can view and edit your account and profile data at any time from your dashboard, and export your profile as a PDF.",
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
      lastUpdatedValue: "June 13, 2026",
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
            "If you allow the analytics category, we use Vercel Web Analytics and Speed Insights to measure aggregate usage and performance. They run only after your consent and stay off until then.",
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
      lastUpdatedValue: "13 червня 2026",
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
          title: "Акаунт і контент",
          paragraphs: [
            "Ви відповідаєте за достовірність інформації, яку публікуєте в акаунті, профілі, проєктах, статтях, опитуваннях і коментарях.",
            "Права на ваш контент залишаються за вами, але ви дозволяєте SearchTalent зберігати, показувати й обробляти його в межах роботи сервісу.",
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
      lastUpdatedValue: "13 червня 2026",
      hubLabel: "Правовий розділ",
      sections: [
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
          ],
        },
        {
          title: "AI-функції",
          paragraphs: [
            "Деякі необов'язкові функції використовують AI, щоб допомогти створити чернетку або стислий виклад контенту. Коли ви ними користуєтеся, наданий вами текст і контекст — який може містити дані профілю чи проєкту — надсилається до Google Gemini API для генерації відповіді.",
            "Ці функції необов'язкові. Будь ласка, не надсилайте інформацію, яку не хочете передавати сторонньому AI-провайдеру.",
          ],
        },
        {
          title: "Аналітика та cookies",
          paragraphs: [
            "Аналітика використання й продуктивності працює лише після того, як ви дозволите категорію «аналітика» в банері згоди на cookies; до цього вона вимкнена.",
            "Лічильники переглядів контенту зберігаються в агрегованому вигляді й не використовуються для створення профілю окремого відвідувача. Деталі про cookies та подібне сховище — у Політиці cookies.",
          ],
        },
        {
          title: "Ваші права та видалення акаунта",
          paragraphs: [
            "Ви будь-коли можете переглянути й відредагувати дані акаунта та профілю в дашборді, а також експортувати профіль у PDF.",
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
      lastUpdatedValue: "13 червня 2026",
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
            "Якщо ви дозволите категорію «аналітика», ми використовуємо Vercel Web Analytics і Speed Insights для вимірювання агрегованого використання й продуктивності. Вони працюють лише після вашої згоди й до того лишаються вимкненими.",
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
