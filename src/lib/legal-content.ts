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
      lastUpdatedValue: "October 1, 2026",
      hubLabel: "Legal hub",
      sections: [
        {
          title: "Using the platform",
          paragraphs: [
            "SearchTalent lets people create accounts, publish profiles and projects, write articles, run and answer polls, comment, react, vote, follow others, create pages for companies and their teams, and explore public work across the community.",
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
          title: "“Open to” and contacting people",
          paragraphs: [
            "You can mark on your page what you are open to — freelance, a job, an internship, collaboration, or mentoring — and other people can contact you through the “Contact” button.",
            "Any agreement that follows is made directly between the people involved. SearchTalent is not a party to it, does not check offers or the people who make them, and is not responsible for how an agreement is carried out.",
          ],
          bullets: [
            "Use contact details from SearchTalent only to reach the person about their work. Do not send spam or collect addresses.",
            "Email and phone are shown only to signed-in people, and the number of profiles one account can open contacts for is limited.",
          ],
        },
        {
          title: "Company pages and hiring",
          paragraphs: [
            "Anyone with a confirmed account can create a page for a company or an educational institution and invite colleagues to its team. You may create a page only for an organization you are entitled to represent. The team members are shown on the page.",
            "SearchTalent helps companies and specialists find each other, but it is not a party to hiring: it does not employ anyone, does not check offers, and does not guarantee the outcome of any agreement.",
            "The “Verified company” mark means that a team member confirmed an email address on the company's domain, or that SearchTalent checked the page. It is not a recommendation of the company. A new name or website takes the mark off until the page is verified again.",
            "“Confirmed by the company” on a project means that someone from the company's team confirmed the work was done for it. The author remains responsible for everything else the project says, including who it was made for and the budget.",
            "A company's team can post vacancies: jobs, internships, and freelance tasks. A job or an internship states its pay. A vacancy of a page that is not verified is checked by a moderator before it is shown, and again whenever its text changes. A vacancy stays open for 60 days unless the team extends it. A vacancy reported as a scam is hidden until a moderator looks at it.",
          ],
          bullets: [
            "Do not charge candidates for anything — not for applying, training, equipment, or “registration”.",
            "Only real companies and real offers. Do not use a page to collect personal data or to lure people to other services.",
            "No discrimination: do not select or turn down people by sex, age, ethnicity, religion, disability, or other protected characteristics, and do not write such requirements.",
            "A violation means the page is hidden or removed, and the accounts involved may be blocked.",
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
            "A report of sexual, dangerous, or hateful content hides that profile, project, article, or company page until a moderator looks at it; if the report turns out to be wrong, the content comes back.",
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
      lastUpdatedValue: "October 1, 2026",
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
            "Professional information: skills, languages, work experience, education, certificates (including any files you upload), experience level, what you are open to (freelance, a job, an internship, collaboration, mentoring) and when you last confirmed it, preferred work formats, and salary expectations and an hourly rate if you choose to provide them.",
            "Opening someone's contacts: when you are signed in and press “Contact” on another person's page, we record that your account opened that profile's contacts and when.",
            "Content and community activity: projects, articles, polls and your poll responses, comments, reactions, votes, follows, bookmarks, badges, notifications, and your position on the leaderboard.",
            "Project details, if you add them: who the project was made for (yourself, a client, an employer, your studies, or open source), the client's or company's name or a note that it is under an NDA, and the budget.",
            "Company pages: the organization's name, logo, website, description, size and location; who created the page; who is on its team and in what role; invitations to join it; which projects were added to the page, by whom, and who from the company confirmed them.",
            "Vacancies: what a company's team publishes about a vacancy (title, description, type, format, place, level, skills, pay, language), who on the team posted it, and when it was published, closed, or ended.",
            "Feedback you send: the name, email, and message you submit through the feedback form.",
            "Technical and usage data: information needed for security, reliability, and performance, and aggregate view counts on content.",
            "Page view statistics for profiles, projects, articles, vacancies, and company pages: which page was viewed, whether the visitor came from another SearchTalent page, from another site (its domain only), or directly, and whether they were signed in. We do not store IP addresses or full referring links. A repeat view on the same day is recognized by a code computed from the IP address and browser details together with a random key that we delete the next day; after that, the code cannot be linked to anyone.",
            "For registered users: the time of your last visit, updated at most once an hour.",
            "Only if you allowed analytics cookies: where your first visit came from (the referring site's domain, UTM tags, and the page you landed on), saved to your account once when you sign up.",
          ],
        },
        {
          title: "Why we use it",
          paragraphs: [
            "Your data is used to authenticate access, display the public pages and content you choose to publish, power search and discovery, calculate ratings, badges, and leaderboards, deliver notifications, and respond to feedback or reports.",
            "Some technical data is also used to keep the service secure, reliable, and performant, and to moderate content for the safety of the platform and its users.",
            "View statistics, last-visit times, and sign-up sources are used only in aggregate: to see how many people sign up, publish a first project, come back, and get views of their portfolio from outside the platform. They are not used to profile individual visitors or for advertising.",
            "Records of who opened whose contacts are used for two things only: to show the owner how many people opened their contacts, and to limit how many profiles one account can open, so addresses cannot be harvested. The owner sees the number, never who.",
            "When you verify a company page, we check that the address you use — the one you sign in with, or a work address you enter — is on the company website's domain. For a work address we send a one-time code to it. That address is not shown to anyone and not stored: we keep only its domain and a hash of the code until the code is used or expires 15 minutes later. The page records that it was verified, when, and by whom.",
          ],
        },
        {
          title: "The legal bases we rely on",
          paragraphs: [
            "Where data protection law such as the GDPR applies to you, we process your data on the following bases.",
          ],
          bullets: [
            "Performance of a contract — creating and running your account, publishing the profile, content and company pages you choose to share, and providing the community features described in the Terms of Service.",
            "Your consent — optional analytics and the cookie categories you allow, and the optional AI features. You can withdraw consent at any time, which does not affect processing that already happened.",
            "Our legitimate interests — keeping the platform secure and reliable, preventing spam, abuse, rating manipulation, fake company pages, and the harvesting of contact details, moderating content for the safety of users, and measuring in aggregate how the platform is used (view statistics, last-visit times, and the number of people who opened your contacts). The sign-up source is recorded only with your consent.",
            "Legal obligations — where we are required to keep, provide, or remove data to comply with the law.",
          ],
        },
        {
          title: "Public and private data",
          paragraphs: [
            "Much of what you add is intended to be public — your profile, projects, articles, polls, and comments — and you control which profile sections are visible through your profile visibility settings.",
            "Other information, such as authentication data, your email, feedback submissions, and internal technical records, is used only to operate the service and is not made public.",
            "The email and phone you add to your profile are never public: signed-in people see them only after pressing “Contact” on your page. Salary expectations and the hourly rate are visible only to you until you turn on showing them on your page, each with its own switch. What you are open to is public, as is the date you last confirmed it.",
            "If you join a company's team, your profile appears on the company page. An invitation nobody has answered yet is seen only by the person invited and by the company's team. A published vacancy is public, also after it closes; a draft, and a vacancy waiting for a moderator, are seen only by the company's team. How many people viewed a vacancy is seen by the team only.",
            "Who a project was made for and the client's name are shown on the project page; with the NDA note, only “Client under NDA” is shown. The budget is visible only to you until you turn on showing it. A project you add to a page of a company you are not in is seen only by you and that company's team until the company accepts it.",
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
            "View counts on content are stored in an aggregate form and are not used to build a profile of individual visitors. SearchTalent's own view statistics use no cookies or browser storage and keep no IP addresses, as described above. See the Cookie Policy for details on cookies and similar storage.",
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
            "View statistics keep no data that identifies a visitor once the day's key is deleted. Statistics about views of your pages are deleted together with your account.",
            "A record that one account opened another's contacts is deleted when either account is deleted.",
            "Your place in a company's team is deleted when you leave the team or delete your account. A company page is deleted by its owner, or when the last person in its team deletes their account.",
            "Projects you added stay on the company page after you leave the team; you or the company can take them off at any time. A project's budget and its links to company pages are deleted together with the project.",
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
      lastUpdatedValue: "September 26, 2026",
      hubLabel: "Legal hub",
      sections: [
        {
          title: "What cookies are used for",
          paragraphs: [
            "SearchTalent uses cookies and similar browser storage to keep you signed in, remember your language and theme, record your cookie choices, and — only if you allow it — measure usage and performance.",
            "Optional categories stay off until you make a clear choice through the consent banner or cookie settings.",
            "Counting page views on profiles, projects, and articles for SearchTalent's own statistics uses no cookies and stores nothing in your browser.",
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
            "SearchTalent sign-up source — your browser keeps where your first visit came from (the referring site's domain, UTM tags, and the landing page) in local storage under st_first_touch until you sign up, then sends it to your account once. Withdrawing analytics consent deletes it.",
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
      lastUpdatedValue: "1 жовтня 2026",
      hubLabel: "Правовий розділ",
      sections: [
        {
          title: "Користування платформою",
          paragraphs: [
            "SearchTalent дає змогу створювати акаунти, публікувати профілі та проєкти, писати статті, створювати опитування й відповідати на них, коментувати, ставити реакції, голосувати, підписуватися на інших, створювати сторінки компаній та їхніх команд і переглядати відкриті роботи спільноти.",
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
          title: "«Відкрито до…» і зв'язок між людьми",
          paragraphs: [
            "Ви можете позначити на своїй сторінці, до чого відкриті, — фриланс, робота, стажування, співпраця чи менторство, — а інші люди можуть написати вам через кнопку «Зв'язатися».",
            "Усі подальші домовленості укладаються напряму між людьми. SearchTalent не є їх стороною, не перевіряє пропозиції та тих, хто їх робить, і не відповідає за виконання домовленостей.",
          ],
          bullets: [
            "Використовуйте контакти з SearchTalent лише для того, щоб написати людині щодо її роботи. Не надсилайте спам і не збирайте адреси.",
            "Пошту й телефон бачать лише ті, хто увійшов, а кількість профілів, контакти яких може відкрити один акаунт, обмежена.",
          ],
        },
        {
          title: "Сторінки компаній і найм",
          paragraphs: [
            "Будь-хто з підтвердженим акаунтом може створити сторінку компанії чи навчального закладу й запросити колег до її команди. Створювати сторінку можна лише для організації, яку ви маєте право представляти. Учасників команди видно на сторінці.",
            "SearchTalent допомагає компаніям і фахівцям знайти одне одного, але не є стороною найму: нікого не наймає, не перевіряє пропозиції й не гарантує результату домовленостей.",
            "Позначка «Перевірена компанія» означає, що хтось із команди підтвердив пошту на домені компанії або сторінку перевірив SearchTalent. Це не рекомендація компанії. Нова назва чи новий сайт знімають позначку, доки сторінку не перевірять знову.",
            "«Підтверджено компанією» на проєкті означає, що хтось із команди компанії підтвердив: роботу зроблено для неї. За решту того, що написано в проєкті, зокрема для кого він і який бюджет, відповідає автор.",
            "Команда компанії може розміщувати вакансії: роботу, стажування й фриланс-задачі. У роботи й стажування вказано оплату. Вакансію неперевіреної сторінки перед показом перевіряє модератор, а також щоразу, коли змінюється її текст. Вакансія відкрита 60 днів, якщо команда її не продовжить. Вакансію, на яку поскаржилися як на шахрайство, приховують до рішення модератора.",
          ],
          bullets: [
            "Не беріть із кандидатів гроші ні за що — ні за відгук, ні за навчання, обладнання чи «реєстрацію».",
            "Лише справжні компанії та справжні пропозиції. Не використовуйте сторінку, щоб збирати персональні дані чи заманювати людей на інші сервіси.",
            "Без дискримінації: не відбирайте й не відхиляйте людей за статтю, віком, походженням, релігією, інвалідністю чи іншими захищеними ознаками і не пишіть таких вимог.",
            "За порушення сторінку приховують або видаляють, а причетні акаунти можуть заблокувати.",
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
            "Скарга на сексуальний, небезпечний чи ворожий контент ховає цей профіль, проєкт, статтю чи сторінку компанії, доки модератор його не перегляне; якщо скарга не підтвердиться, контент повернеться.",
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
      lastUpdatedValue: "1 жовтня 2026",
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
            "Професійна інформація: навички, мови, досвід роботи, освіта, сертифікати (зокрема завантажені файли), рівень досвіду, до чого ви відкриті (фриланс, робота, стажування, співпраця, менторство) і коли востаннє це підтвердили, бажані формати роботи, а також зарплатні очікування й погодинна ставка, якщо ви їх вказуєте.",
            "Відкриття чужих контактів: коли ви в системі й натискаєте «Зв'язатися» на сторінці іншої людини, ми записуємо, що ваш акаунт відкрив контакти цього профілю, і коли.",
            "Контент і активність у спільноті: проєкти, статті, опитування та ваші відповіді на них, коментарі, реакції, голоси, підписки, закладки, бейджі, сповіщення й позиція в рейтингу.",
            "Деталі проєкту, якщо ви їх вказуєте: для кого його зроблено (для себе, для замовника, на роботі, під час навчання чи як open source), назва замовника чи компанії або позначка, що він під NDA, і бюджет.",
            "Сторінки компаній: назва організації, логотип, сайт, опис, розмір і розташування; хто створив сторінку; хто в її команді й у якій ролі; запрошення до команди; які проєкти додали на сторінку, хто їх додав і хто з компанії їх підтвердив.",
            "Вакансії: що команда компанії публікує про вакансію (назва, опис, тип, формат, місце, рівень, навички, оплата, мова), хто з команди її розмістив і коли її опублікували, закрили чи коли минув її термін.",
            "Звернення через форму зворотного зв'язку: ім'я, email і повідомлення, які ви надсилаєте.",
            "Технічні дані та дані використання: інформація, потрібна для безпеки, стабільності й продуктивності, та агреговані лічильники переглядів контенту.",
            "Статистика переглядів профілів, проєктів, статей, вакансій і сторінок компаній: яку сторінку переглянули, чи прийшов відвідувач з іншої сторінки SearchTalent, з іншого сайту (лише його домен) чи напряму, і чи був він у системі. IP-адреси й повні посилання, з яких прийшли, ми не зберігаємо. Повторний перегляд того ж дня розпізнається за кодом, обчисленим з IP-адреси й даних браузера разом із випадковим ключем, який ми видаляємо наступного дня; після цього код неможливо пов'язати ні з ким.",
            "Для зареєстрованих користувачів: час вашого останнього візиту, оновлюється не частіше разу на годину.",
            "Лише якщо ви дозволили аналітичні cookies: звідки прийшов ваш перший візит (домен сайту, з якого ви прийшли, UTM-мітки й сторінка, на яку ви потрапили). Зберігається у вашому акаунті один раз під час реєстрації.",
          ],
        },
        {
          title: "Навіщо це потрібно",
          paragraphs: [
            "Ці дані потрібні для авторизації, показу публічних сторінок і контенту, який ви публікуєте, роботи пошуку й навігації, обчислення рейтингів, бейджів і лідербордів, доставки сповіщень та відповідей на звернення.",
            "Частина технічних даних також використовується для безпеки, стабільності й продуктивності сервісу та для модерації контенту заради безпеки платформи й користувачів.",
            "Статистику переглядів, час останнього візиту й джерело реєстрації ми використовуємо лише в агрегованому вигляді: щоб бачити, скільки людей реєструються, публікують перший проєкт, повертаються й отримують перегляди портфоліо ззовні платформи. Для профілювання окремих відвідувачів чи реклами вони не використовуються.",
            "Записи про те, хто відкрив чиї контакти, потрібні лише для двох речей: показати власникові, скільки людей відкрили його контакти, і обмежити, скільки профілів може відкрити один акаунт, щоб адреси не можна було зібрати. Власник бачить лише число, а не те, хто це був.",
            "Коли ви перевіряєте сторінку компанії, ми звіряємо, що адреса, якою ви користуєтеся, — та, з якою ви входите, або робоча, яку ви вводите, — на домені сайту компанії. На робочу адресу ми надсилаємо одноразовий код. Цю адресу нікому не показуємо й не зберігаємо: лишаємо тільки її домен і хеш коду, доки код не використають або доки він не спливе через 15 хвилин. Сторінка запам'ятовує, що її перевірено, коли і ким.",
          ],
        },
        {
          title: "На яких правових підставах ми це робимо",
          paragraphs: [
            "Якщо до вас застосовується законодавство про захист даних, зокрема GDPR, ми обробляємо ваші дані на таких підставах.",
          ],
          bullets: [
            "Виконання договору — створення й робота акаунта, публікація профілю, контенту та сторінок компаній, які ви обираєте показувати, і надання функцій спільноти, описаних в Умовах користування.",
            "Ваша згода — необов'язкова аналітика та категорії cookies, які ви дозволяєте, а також необов'язкові AI-функції. Згоду можна відкликати будь-коли, це не впливає на обробку, що вже відбулася.",
            "Наші законні інтереси — безпека й стабільність платформи, запобігання спаму, зловживанням, маніпуляціям рейтингом, фейковим сторінкам компаній і збиранню контактів, модерація контенту заради безпеки користувачів, а також агреговане вимірювання того, як користуються платформою (статистика переглядів, час останнього візиту й кількість людей, які відкрили ваші контакти). Джерело реєстрації записується лише з вашої згоди.",
            "Правові зобов'язання — коли ми зобов'язані зберігати, надавати або видаляти дані на вимогу закону.",
          ],
        },
        {
          title: "Публічні та непублічні дані",
          paragraphs: [
            "Значна частина того, що ви додаєте, за задумом є публічною — профіль, проєкти, статті, опитування й коментарі, — і ви керуєте тим, які секції профілю видно, через налаштування видимості профілю.",
            "Інша інформація, як-от дані авторизації, ваш email, звернення через форму зворотного зв'язку та внутрішні технічні записи, використовується лише для роботи сервісу й не стає публічною.",
            "Пошта й телефон, які ви додаєте в профіль, ніколи не публічні: люди в системі бачать їх лише після того, як натиснуть «Зв'язатися» на вашій сторінці. Зарплатні очікування й погодинну ставку бачите лише ви, доки не ввімкнете їхній показ на сторінці, окремо для кожного. Те, до чого ви відкриті, публічне, як і дата, коли ви востаннє це підтвердили.",
            "Якщо ви приєднуєтеся до команди компанії, ваш профіль з'являється на сторінці компанії. Запрошення, на яке ще не відповіли, бачать лише запрошена людина й команда компанії. Опублікована вакансія публічна, зокрема й після закриття; чернетку й вакансію, що чекає на модератора, бачить лише команда компанії. Скільки людей переглянули вакансію, бачить лише команда.",
            "Для кого зроблено проєкт і назву замовника видно на сторінці проєкту; з позначкою NDA там буде лише «Замовник під NDA». Бюджет бачите тільки ви, доки не ввімкнете його показ. Проєкт, який ви додали на сторінку компанії, де ви не в команді, бачите лише ви й команда цієї компанії, доки компанія його не прийме.",
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
            "Лічильники переглядів контенту зберігаються в агрегованому вигляді й не використовуються для створення профілю окремого відвідувача. Власна статистика переглядів SearchTalent не використовує cookies чи сховище браузера й не зберігає IP-адреси, як описано вище. Деталі про cookies та подібне сховище — у Політиці cookies.",
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
            "Після видалення добового ключа статистика переглядів не містить даних, за якими можна впізнати відвідувача. Статистика переглядів ваших сторінок видаляється разом з акаунтом.",
            "Запис про те, що один акаунт відкрив контакти іншого, видаляється, коли видаляють будь-який із цих акаунтів.",
            "Ваше місце в команді компанії видаляється, коли ви виходите з команди або видаляєте акаунт. Сторінку компанії видаляє її власник; вона також видаляється, коли останній учасник команди видаляє свій акаунт.",
            "Проєкти, які ви додали, лишаються на сторінці компанії й після того, як ви вийдете з команди; прибрати їх можете ви або компанія будь-коли. Бюджет проєкту та його зв'язки зі сторінками компаній видаляються разом із проєктом.",
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
      lastUpdatedValue: "26 вересня 2026",
      hubLabel: "Правовий розділ",
      sections: [
        {
          title: "Для чого використовуються cookies",
          paragraphs: [
            "SearchTalent використовує cookies і подібне браузерне сховище, щоб тримати вас у системі, запам'ятовувати мову й тему, зберігати ваш вибір щодо cookies та — лише з вашого дозволу — вимірювати використання й продуктивність.",
            "Необов'язкові категорії залишаються вимкненими, доки ви не зробите явний вибір у банері згоди або в налаштуваннях cookies.",
            "Підрахунок переглядів профілів, проєктів і статей для власної статистики SearchTalent не використовує cookies і нічого не зберігає у вашому браузері.",
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
            "Джерело реєстрації SearchTalent — браузер зберігає, звідки прийшов ваш перший візит (домен сайту, UTM-мітки й сторінку входу), у локальному сховищі під ключем st_first_touch, доки ви не зареєструєтеся, а тоді один раз надсилає це у ваш акаунт. Відкликання згоди на аналітику видаляє запис.",
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
